# B2B → Dílna: serverové poptávky a e-mailové oznámení

## Cíl

Zákaznické formuláře na GitHub Pages (`arkeeas.github.io`) a B2B (`b2b.skovem.cz`) uloží nové poptávky na server Wedosu, aby se zobrazily v interním přehledu na `dilna.skovem.cz` napříč zařízeními. Běžné poptávky vyvolají oznámení na `info@skovem.cz`. Jméno, které po oříznutí mezer odpovídá `test` bez ohledu na velikost písmen, se uloží, ale e-mail se nepošle.

## Současný stav

Hlavní zákaznický konfigurátor je na GitHub Pages; B2B má samostatný formulář. Dílna na `dilna.skovem.cz` je interní přehled a používá `lokal.js`, který nahrazuje databázi úložištěm `localStorage` konkrétního prohlížeče. Proto zákaznické poptávky nejsou sdílené s dílnou ani mezi různými zařízeními. Staré testovací záznamy zůstávají jen v místním úložišti konkrétního prohlížeče. Nová serverová evidence začne prázdná; lokální záznamy ani staré testy se do ní automaticky nekopírují, takže v ní budou vidět jen nové serverově přijaté poptávky. Dílna je chráněná HTTP Basic Authentication. WEDOS nyní zobrazuje aktivní Let's Encrypt certifikát zahrnující `dilna.skovem.cz`; skutečné spojení musí po nasazení potvrdit prohlížeč.

## Návrh

- Přidat PHP API na `dilna.skovem.cz` a uložit každou poptávku do JSON souboru v adresáři zakázaném pro přímé HTTP čtení. Použít bezpečné ID, validaci polí, limit velikosti požadavku, zamykání při zápisu a atomické nahrazení souboru.
- API povolí nepřihlášenou `POST` operaci pouze pro vytvoření poptávky a pouze z přesných originů `https://b2b.skovem.cz` a `https://arkeeas.github.io`. Před ní prohlížeč může poslat CORS `OPTIONS` preflight; ten smí dostat pouze minimální CORS odpověď pro přesný origin a požadovanou metodu `POST`. V `.htaccess` zůstane Basic Authentication vyžadována pro čtení seznamu, změny stavu i ostatní metody; veřejné `POST` bude PHP handler přijímat jen pro založení poptávky. Server bude odmítat požadavky s jiným Origin a omezovat opakované odesílání z jedné IP; odpověď nebude obsahovat žádná uložená zákaznická data.
- Zákaznické formuláře na GitHub Pages a B2B odešlou poptávku na API přes HTTPS. Zachovají stávající lokální fallback pro vývoj/preview bez serveru. Potvrzení ukážou až poté, co API poptávku uloží.
- Po uložení: u jména `test` přeskočit mail; jinak odeslat shrnutí včetně konfigurace na pevně nastavenou adresu `info@skovem.cz` přes PHP `mail()`, s firemním `From`/return-path a validovaným `Reply-To` zákazníka.
- Dílenský přehled bude načítat uložené poptávky a jejich stavy z API. Jeho čtecí a aktualizační operace vyžadují Basic Authentication. Zachovat současnou tabulku, detail a pole poptávky.
- Pokud uložení selže, zobrazit chybu bez falešného potvrzení. Pokud se poptávka uloží a mail selže, ponechat ji v dílně a oznámit uživateli, že e-mailové upozornění nebylo přijato k odeslání.

## Rozhraní a kompatibilita

Přes přeshraniční API se posílá jen nový záznam a vrací se pouze ID, stav uložení a stav pokusu o e-mail. Server nesmí přijímat cesty nebo názvy souborů od klienta. Zachovat existující pole poptávky (`id`, `created`, `status`, `customer`, `note`, `config`, `price`, `vat`, `total`) a stavy používané v interním seznamu. Odesílací adresa musí být existující firemní schránka na `skovem.cz`.

## Ověření

- Statická kontrola PHP syntaxe a JavaScriptu bez zásahu do produkčních dat.
- Ověřit běžné odeslání: poptávka se uloží, zobrazí v Dílna a PHP se pokusí odeslat mail na firemní adresu.
- Ověřit jméno ` test `: poptávka se uloží a e-mailová funkce se nevolá.
- Ověřit odmítnutí jiného Origin, neplatného nebo příliš velkého vstupu a přímého HTTP přístupu k souborům.
- Ověřit chyby ukládání a e-mailu, včetně zachování poptávky při chybě e-mailu.
- Doručení do schránky lze potvrdit až po nasazení, platném HTTPS certifikátu a skutečném produkčním odeslání.

## Omezení

Povolení podle Origin omezuje běžné požadavky z prohlížeče, ale není náhradou za validaci a rate limit; veřejnou `POST` operaci lze volat i mimo prohlížeč. PHP `mail()` potvrzuje pouze přijetí zprávy k odeslání. WEDOS uvádí nutnost nastavit return-path; skutečné doručení závisí na konfiguraci DNS a e-mailu. Viz [návod Wedosu k PHP mail()](https://help.wedos.cz/navody/e-maily/odesilani-e-mailu-pomoci-php-mail/).
