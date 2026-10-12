# Skovo – umělecké podnože

Tento balíček obsahuje samostatnou stránku z konfigurátoru Skovo: Kosočtverec, Pavouk a Pohozenec. Zachovává 3D náhled Three.js, rozměry, volby konstrukce, výpočetní jádro, kontrolu zatížení a formulář poptávky z konfigurátoru na GitHub Pages.

## Nahrání na Wedos

Nahrajte **obsah** ZIPu do kořenové složky cílové subdomény (pro B2B do `/www/subdom/b2b/`), aby `index.html` ležel přímo v tomto adresáři. Zachovejte složky a názvy souborů, zejména `vendor/`.

Three.js 0.147 a OrbitControls jsou přiloženy lokálně, takže 3D knihovny není nutné stahovat z CDN.

## Aktualizace jen změněných souborů

`deploy.py` je nástroj pro lokální FTPS aktualizaci. Porovná obsah souborů se serverem, nahraje jen rozdíly a před přepsáním stáhne starou verzi do složky `backups/`. Vzdálené soubory nemaže. Spouští se z počítače:

```bash
python3 podnoze_wedos/deploy.py --dry-run
python3 podnoze_wedos/deploy.py
```

Heslo můžeš uložit do systémové klíčenky GNOME Keyring, aby se při dalších nahráváních nenačítalo znovu ručně. Na Ubuntu/Debianu nainstaluj nástroj a jednou ulož heslo:

```bash
sudo apt install libsecret-tools
python3 podnoze_wedos/deploy.py --store-password
```

Potom běžné `deploy.py` heslo načte z klíčenky. Pokud nástroj není nainstalovaný nebo heslo v klíčence chybí, uploader ho vyžádá skrytě v terminálu. Heslo nevkládej do projektu, argumentů příkazu ani chatu. Účet `w405398_b2b` musí být omezený na `/www/subdom/b2b`.

## Ukládání poptávek

Toto je statická verze. Nastavení a poptávky se ukládají do místního úložiště konkrétního prohlížeče; stránka je sama neposílá na e-mail ani do databáze.
