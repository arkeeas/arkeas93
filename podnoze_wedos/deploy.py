#!/usr/bin/env python3
"""Upload changed static files to the scoped Skovo Wedos FTP account over explicit FTPS."""

from __future__ import annotations

import argparse
import ftplib
import getpass
import hashlib
import io
import shutil
import ssl
import subprocess
import sys
from datetime import datetime
from pathlib import Path


class SessionReuseFTP_TLS(ftplib.FTP_TLS):
    """FTP_TLS variant for servers requiring the data TLS session to resume control TLS."""

    def ntransfercmd(self, cmd: str, rest: str | None = None):
        conn, size = ftplib.FTP.ntransfercmd(self, cmd, rest)
        if self._prot_p:
            conn = self.context.wrap_socket(
                conn,
                server_hostname=self.host,
                session=self.sock.session,
            )
        return conn, size


HOST = "405398.w98.wedos.net"
USER = "w405398_b2b"
REMOTE_ROOT = "/"  # The FTP account is scoped to /www/subdom/b2b.
EXCLUDE = {"deploy.py", "README.md", "test_deploy.py", "__pycache__"}
KEYRING_ATTRIBUTES = ("service", "skovo-wedos", "username", USER)


def secret_tool(*args: str, password: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["secret-tool", *args], input=password, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False,
    )


def stored_password() -> str | None:
    if shutil.which("secret-tool") is None:
        return None
    result = secret_tool("lookup", *KEYRING_ATTRIBUTES)
    return result.stdout.rstrip("\n") if result.returncode == 0 and result.stdout else None


def store_password() -> int:
    if shutil.which("secret-tool") is None:
        print("Chybí secret-tool. Nainstaluj ho příkazem: sudo apt install libsecret-tools", file=sys.stderr)
        return 2
    if not sys.stdin.isatty():
        print("Spusť příkaz přímo v terminálu, aby šlo heslo zadat skrytě.", file=sys.stderr)
        return 2
    password = getpass.getpass(f"Nové FTPS heslo pro {USER} (zadání je skryté): ")
    if not password:
        print("Heslo nesmí být prázdné.", file=sys.stderr)
        return 2
    result = secret_tool("store", "--label=Skovo B2B Wedos FTPS", *KEYRING_ATTRIBUTES, password=password + "\n")
    if result.returncode != 0:
        print("Uložení do GNOME Keyring se nezdařilo.", file=sys.stderr)
        return 1
    if stored_password() != password:
        print("Ověření uloženého hesla se nezdařilo.", file=sys.stderr)
        return 1
    print("FTPS heslo je uložené v GNOME Keyring.")
    return 0


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def local_files(root: Path) -> list[Path]:
    return sorted(
        path for path in root.rglob("*")
        if path.is_file() and not any(part in EXCLUDE for part in path.relative_to(root).parts)
    )


def ensure_remote_dirs(ftp: ftplib.FTP_TLS, relative: Path) -> None:
    parts = relative.parts[:-1]
    ftp.cwd(REMOTE_ROOT)
    for part in parts:
        try:
            ftp.cwd(part)
        except ftplib.error_perm:
            ftp.mkd(part)
            ftp.cwd(part)


def read_remote(ftp: ftplib.FTP_TLS, relative: Path) -> bytes | None:
    try:
        ftp.cwd(REMOTE_ROOT)
        buffer = io.BytesIO()
        ftp.retrbinary(f"RETR {relative.as_posix()}", buffer.write)
        return buffer.getvalue()
    except ftplib.error_perm as exc:
        if str(exc).startswith("550"):
            return None
        raise


def main() -> int:
    parser = argparse.ArgumentParser(description="Synchronize changed Skovo configurator files to Wedos.")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent,
                        help="Local site folder (defaults to this script's folder)")
    parser.add_argument("--dry-run", action="store_true", help="List changed files without uploading")
    parser.add_argument("--store-password", action="store_true", help="Securely save the FTPS password in GNOME Keyring")
    args = parser.parse_args()
    if args.store_password:
        return store_password()
    root = args.root.resolve()
    if not (root / "index.html").is_file():
        parser.error(f"No index.html in local site folder: {root}")

    password = stored_password()
    if password is None:
        if shutil.which("secret-tool") is None:
            print("Tip: sudo apt install libsecret-tools, potom spusť deploy.py --store-password pro uložení hesla.")
        if not sys.stdin.isatty():
            print("Heslo není v klíčence a skryté zadání vyžaduje terminál.", file=sys.stderr)
            return 2
        password = getpass.getpass(f"FTPS password for {USER} (input is hidden): ")
    context = ssl.create_default_context()
    changed: list[tuple[Path, bytes]] = []

    try:
        with SessionReuseFTP_TLS(context=context, timeout=30) as ftp:
            ftp.connect(HOST, 21)
            ftp.login(USER, password)
            ftp.prot_p()
            ftp.cwd(REMOTE_ROOT)
            for path in local_files(root):
                relative = path.relative_to(root)
                payload = path.read_bytes()
                old = read_remote(ftp, relative)
                if old is None or digest(old) != digest(payload):
                    changed.append((relative, payload))

            if not changed:
                print("Wedos už obsahuje aktuální soubory.")
                return 0

            print("Změněné soubory:")
            for relative, _ in changed:
                print(f"  {relative.as_posix()}")
            if args.dry_run:
                print("Suchý běh: nic nebylo nahráno.")
                return 0

            stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
            backup_root = root.parent / "backups" / stamp
            for relative, payload in changed:
                old = read_remote(ftp, relative)
                if old is not None:
                    backup = backup_root / relative
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    backup.write_bytes(old)
                ensure_remote_dirs(ftp, relative)
                ftp.cwd(REMOTE_ROOT)
                with (root / relative).open("rb") as source:
                    ftp.storbinary(f"STOR {relative.as_posix()}", source)

        print(f"Nahráno {len(changed)} souborů přes FTPS. Předchozí verze jsou v {backup_root if backup_root.exists() else 'bez záloh (nové soubory)' }.")
        return 0
    except ftplib.all_errors as exc:
        print(f"Nahrávání selhalo: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
