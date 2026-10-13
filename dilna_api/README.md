# Dílna inquiry API

This directory contains the PHP API to deploy into the root of `dilna.skovem.cz`.

- Copy `poptavky.php` to the Dílna document root.
- Merge `dilna-root.htaccess` into the existing root `.htaccess`, preserving the existing Basic Auth password file. The `poptavky.php` exception allows unauthenticated POST/OPTIONS only; the script accepts public POST only for inquiry creation from the exact allowed web origins.
- Copy the `data/` directory beside `poptavky.php`. Its `.htaccess` denies direct HTTP access. PHP must be able to create JSON and lock files there.
- Ordinary inquiries are stored before PHP attempts to send the notification to `info@skovem.cz`. Names equal to `test` after trimming and case folding are stored without calling `mail()`.

WEDOS documents the need to set the `-f` return-path on PHP `mail()`. The sender in the API is `info@skovem.cz`; verify that address and the domain's mail DNS are configured before relying on delivery. A true return from `mail()` only means the server accepted the message for sending.
