import { Link } from 'react-router-dom'
import { InfoShell, H2, H3 } from '../components/layout/InfoShell'

/**
 * /navod — full user manual. Longer-form than /ako-to-funguje (which is a
 * 9-step quick onboarding); this is the reference doc the user can keep
 * coming back to whenever they get stuck. Organised into sections with a
 * table of contents that anchors-jumps inside the page.
 */
export function Navod() {
  return (
    <InfoShell
      eyebrow="✦ Pergamen návodu ✦"
      title={
        <>
          Návod <span className="text-gold-bright">na použitie</span>
        </>
      }
    >
      <p className="italic text-text-secondary">
        Všetko čo potrebuješ vedieť aby si appku zvládol — od prvého
        prihlásenia po pokročilú prácu s AI kategorizáciou. Klikni na
        sekciu v obsahu a skoč rovno k nej.
      </p>

      {/* Table of contents */}
      <nav className="border border-border-dim border-l-[3px] border-l-gold rounded-[3px] px-5 py-4 bg-stone/40">
        <p className="font-heading text-[0.6rem] uppercase tracking-widest text-gold mb-3">
          ✦ Obsah
        </p>
        <ol className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 list-decimal list-inside text-sm">
          <Toc href="#start">Začni tu</Toc>
          <Toc href="#banky">Banky</Toc>
          <Toc href="#import">Import výpisov</Toc>
          <Toc href="#dnd">Drag &amp; drop</Toc>
          <Toc href="#ai">AI kategorizácia</Toc>
          <Toc href="#manual">Manuálna úprava</Toc>
          <Toc href="#pamat">Pamäť cez merchant</Toc>
          <Toc href="#dashboard">Dashboard prehľad</Toc>
          <Toc href="#raul">Raul odporúčania</Toc>
          <Toc href="#hypoteky">Hypotéky</Toc>
          <Toc href="#reporty">Email reporty</Toc>
          <Toc href="#nastavenia">Nastavenia účtu</Toc>
          <Toc href="#tipy">Klávesové skratky a tipy</Toc>
          <Toc href="#sukromie">Súkromie a bezpečnosť</Toc>
        </ol>
      </nav>

      {/* 1 — Začni tu */}
      <H2 id="start">1. ⚡ Začni tu</H2>
      <p>
        Tri kroky aby si dostal prvé čísla na obrazovku. Predpokladáme že
        už máš účet — ak nie, zaregistruj sa, potvrď email cez link zo
        sovy a vráť sa.
      </p>
      <ol className="list-decimal pl-6 space-y-1">
        <li>
          <strong>Pridaj si banku</strong> v sekcii{' '}
          <a href="#banky" className="text-gold hover:text-gold-bright underline">
            Banky
          </a>
          {' '}— stačí názov („SLSP bežný"), typ a zdrojová banka. Slúži to
          len na rozdelenie transakcií, nie na prístup k internet bankingu.
        </li>
        <li>
          <strong>Naimportuj výpis</strong> — pretiahni PDF/CSV súbor zo
          svojej banky priamo do dropzone alebo klikni a vyber súbor.
        </li>
        <li>
          <strong>Klikni „🔮 Roztriediť výdavky kúzlom"</strong> — AI
          (GPT-4o-mini) priradí každej transakcii kategóriu a vytiahne
          z popisu meno firmy. Otvor dashboard a uvidíš grafy + Raulove
          odporúčania.
        </li>
      </ol>

      {/* 2 — Banky */}
      <H2 id="banky">2. 🏦 Banky</H2>
      <p>
        Banka v appke nie je reálny účet — je to len kontajner pre
        transakcie z jedného zdroja. Konvencia: jedna banka = jeden účet.
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Klikni <strong>„+ Nová banka"</strong> v <code className="text-gold font-mono text-sm">/banky</code></li>
        <li>Zadaj názov, typ (bežný / sporiaci / kreditka) a zdroj (SLSP / Tatra / Revolut / manuálne)</li>
        <li>Pridaj zostatok ak chceš mať v hlavičke karty referenčné číslo (manuálne, neaktualizuje sa)</li>
      </ul>
      <H3>Čo to NIE JE</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li>❌ Nepripájame sa cez Open Banking API</li>
        <li>❌ Nevyžadujeme prihlasovacie údaje do banky</li>
        <li>❌ Nemáme prístup k tvojim peniazom — vidíme len to čo nahráš ako PDF/CSV</li>
      </ul>

      {/* 3 — Import */}
      <H2 id="import">3. 📜 Import výpisov</H2>
      <p>
        Stiahni si PDF alebo CSV výpis zo svojej banky a nahraj ho cez
        modál <strong>„⌬ Importovať"</strong> pri konkrétnej banke.
      </p>
      <H3>Podporované formáty</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>SLSP</strong> — PDF (mesačný výpis aj jednorazové výpisy) + CSV export z George</li>
        <li><strong>Tatra banka</strong> — CSV export z internet bankingu</li>
        <li><strong>Revolut</strong> — CSV statement export</li>
      </ul>
      <p>
        Auto-detekciu formátu vidíš v náhľade. Ak sa zmýli, prepni manuálne
        cez „Formát" tlačidlá.
      </p>
      <H3>Náhľad pred importom</H3>
      <p>
        Po načítaní súboru sa zobrazí <strong>preview</strong> — vidíš
        koľko riadkov sa zaimportuje, koľko duplikátov (už existujú v DB
        podľa per-bank fingerprintu) a paretto sumy. Klikni „Potvrdiť"
        keď sa ti to páči, alebo „Zrušiť" a skús iný súbor.
      </p>
      <H3>Duplikáty</H3>
      <p>
        Bezpečne môžeš importovať ten istý PDF dvakrát — duplikáty sa
        chytia automaticky cez fingerprint <code className="text-gold font-mono text-sm">
        (bank_id, hash(date+amount+description))</code> a preskočia.
      </p>

      {/* 4 — Drag & Drop */}
      <H2 id="dnd">4. 🪣 Drag &amp; drop</H2>
      <p>
        Nemusíš klikať na dropzone — pretiahni súbor priamo z Downloads
        / Finder / Explorer myšou nad dashed box. Box sa rozžiari
        a zmení text na „Pusti súbor sem". Po pustení sa rozparsuje
        rovnako ako pri kliknutí.
      </p>
      <p>
        Bonus: ak ti náhodou súbor padne <em>vedľa</em> dropzone (na tmavé
        pozadie modálu), nič sa nestane — appka chráni pred tým aby ti
        prehliadač otvoril PDF v novom tabe a stratil si formulár.
      </p>

      {/* 5 — AI kategorizácia */}
      <H2 id="ai">5. 🔮 AI kategorizácia</H2>
      <p>
        Po importe sú všetky transakcie v kategórii „Nezaradené". Pre
        prvé roztriedenie máš dva režimy:
      </p>
      <H3>Štandardný režim — „🔮 Roztriediť výdavky kúzlom"</H3>
      <p>
        Pošle len <strong>nezaradené</strong> transakcie do OpenAI. Tie čo
        máš ručne nastavené (alebo z predchádzajúcej AI behu) sa nemenia.
        Šetrí tokeny pri opakovanom importe.
      </p>
      <H3>Force režim — „🔄 Pretriediť všetko znovu"</H3>
      <p>
        Pretriedi <strong>všetky</strong> transakcie OKREM tých čo si ručne
        upravil. Tvoje manuálne overrides ostávajú nedotknuté. Použi keď
        sa zmenil prompt alebo chceš obnoviť konzistenciu.
      </p>
      <H3>Čo AI vracia pre každú transakciu</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>category</strong> — Slovenský label (1-3 slová): Potraviny, Reštaurácie, Auto…</li>
        <li><strong>merchant</strong> — Čisté meno firmy: „Tesco", „BTS Airport", „Slovnaft"</li>
        <li><strong>confidence</strong> — 0..1 istota AI (hover nad farebnou kategóriou)</li>
      </ul>
      <H3>Náklady</H3>
      <p>
        GPT-4o-mini ~ <strong>0.15 USD / 1M input tokenov</strong>. Typický
        výpis 100-200 transakcií = ~5 000 tokenov = <strong>~0.001 USD</strong>.
        Mesačné kategorizovanie pre jedného userka = setina centa. Stojí to za to.
      </p>

      {/* 6 — Manuálna úprava */}
      <H2 id="manual">6. ✏️ Manuálna úprava kategórií</H2>
      <p>
        Klikni na pole s kategóriou pri ľubovoľnej transakcii (na Dashboarde
        aj v <code className="text-gold font-mono text-sm">/vydavky</code>),
        začni písať a appka ti ponúkne existujúce kategórie cez datalist.
        Môžeš zadať aj úplne novú — neexistuje whitelist.
      </p>
      <H3>Klávesnica</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li><kbd className="font-mono text-xs bg-stone/60 border border-border-dim px-1.5 py-0.5 rounded">Enter</kbd> alebo <kbd className="font-mono text-xs bg-stone/60 border border-border-dim px-1.5 py-0.5 rounded">Tab</kbd> uloží</li>
        <li><kbd className="font-mono text-xs bg-stone/60 border border-border-dim px-1.5 py-0.5 rounded">Esc</kbd> zruší zmenu</li>
        <li>Min 2 znaky, max 60 znakov</li>
      </ul>
      <H3>Farba kategórie</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li><span className="text-gold-bright">Zlatá</span> = ručne upravená používateľom (vyhráva nad AI)</li>
        <li><span className="text-cobalt-bright">Modrá</span> = nastavená AI (hover → confidence %)</li>
        <li><span className="text-text-secondary">Šedá</span> = ešte nezaradená</li>
      </ul>

      {/* 7 — Pamäť cez merchant */}
      <H2 id="pamat">7. 🧠 Pamäť cez merchant (rules)</H2>
      <p>
        Appka si pamätá tvoje rozhodnutia. Keď ručne prepíšeš kategóriu
        pri transakcii „Tesco Petržalka", uloží sa <strong>rule</strong>{' '}
        pre kľúč „merchant: tesco" aj pre kľúč „note: tesco petržalka".
        Pri ďalšom importe:
      </p>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Najprv sa skúsi <strong>merchant lookup</strong> — chytí všetky Tesco pobočky</li>
        <li>Potom <strong>note lookup</strong> — chytí takmer rovnaké popisy</li>
        <li>Až čo neprejde rules → AI</li>
      </ol>
      <p>
        Praktický dôsledok: jedna oprava sa <strong>propaguje na všetky
        budúce transakcie z rovnakej firmy</strong>, aj keď bude každá
        z inej pobočky alebo s mierne odlišným popisom v note. AI sa
        zavolá iba na nové merchantov.
      </p>
      <H3>Hierarchia</H3>
      <p>
        User pravidlo (ručne uložené) <strong>vyhráva</strong> nad AI pravidlom
        pre rovnaký kľúč. AI ti tvoju voľbu neprepíše.
      </p>

      {/* 8 — Dashboard */}
      <H2 id="dashboard">8. 📊 Dashboard prehľad</H2>
      <p>
        Hlavná obrazovka. Defaultne sa otvorí na <strong>predchádzajúcom
        mesiaci</strong> (alebo poslednom mesiaci kde sú nejaké dáta).
        Mesiac prepneš v MonthPickere vpravo hore.
      </p>
      <H3>Sekcie zhora dole</H3>
      <ol className="list-decimal pl-6 space-y-1">
        <li><strong>3 stat karty</strong> — Príjmy / Výdavky / Splátky za zvolený mesiac</li>
        <li><strong>Top 6 kategórií</strong> — mini tiles s najväčšími výdavkami</li>
        <li><strong>Príjmy vs Výdavky</strong> — 6-mesačný stacked graf + net cashflow sparkline + bank breakdown</li>
        <li><strong>Raul</strong> — AI odporúčania (auto-generated pri prvom otvorení mesiaca)</li>
        <li><strong>Kategórie trend</strong> — 6-mesačný stacked bar po kategóriách + breakdown aktuálneho mesiaca</li>
        <li><strong>Posledné transakcie</strong> — 10 najnovších, s editovateľnou kategóriou inline</li>
        <li><strong>Banky</strong> — zoznam tvojich účtov</li>
      </ol>

      {/* 9 — Raul */}
      <H2 id="raul">9. 🪄 Raul odporúčania</H2>
      <p>
        Raul Rodriguez = persona finančného manažéra. Hovorí slovensky,
        s 15-ročnou praxou. Pri prvom otvorení mesiaca sa <strong>automaticky
        spustí</strong> ak ešte neexistuje cached odporúčanie.
      </p>
      <H3>Formát výstupu</H3>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Krátky úvod (1-2 vety) — najdôležitejší pattern v dátach</li>
        <li><strong>„Top 3 odporúčania:"</strong> ako očíslovaný zoznam — každé s konkrétnou sumou a potenciálom úspory</li>
        <li>Krátky záver — pozitívny tón alebo nemorálne pozorovanie</li>
      </ol>
      <H3>Čo Raul vie a čo nevie</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li>✅ Konkrétne rady o míňaní (Wolt 240 € → varenie doma 3× / týždeň ušetrí ~120 €)</li>
        <li>✅ Porovnanie medzimesačných zmien, identifikácia nezvyčajných výdavkov</li>
        <li>❌ NIKDY neradí investície, úvery, poistenie (to nech rieši licencovaný poradca)</li>
        <li>❌ Ignoruje kategóriu „Iné" — neradí ti na čo nedokáže pripomenkovať</li>
      </ul>
      <p>
        „🔄 Vygenerovať znovu" = nový OpenAI call (~0.001 USD). Cached
        odporúčania sú zdarma — appka ich uloží do DB a podáva ti ich
        z pamäte.
      </p>

      {/* 10 — Hypotéky */}
      <H2 id="hypoteky">10. 🏠 Hypotéky</H2>
      <p>
        V <code className="text-gold font-mono text-sm">/hypoteky</code>
        eviduješ dlhodobé záväzky:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Nehnuteľnosť</strong> — názov (napr. „Byt Petržalka")</li>
        <li><strong>Banka</strong>, <strong>celková suma</strong>, <strong>zostatok</strong></li>
        <li><strong>Mesačná splátka</strong> — sčíta sa do dashboard kartičky „Splátky / mesiac"</li>
        <li><strong>Úroková sadzba</strong>, dátumy</li>
      </ul>
      <p>
        Splátky sa <strong>nemenia automaticky</strong> ani po importe
        výpisu — musíš ručne aktualizovať zostatok keď je toho čas (raz
        za rok).
      </p>

      {/* 11 — Email reporty */}
      <H2 id="reporty">11. 🦉 Email reporty</H2>
      <p>
        V <code className="text-gold font-mono text-sm">/nastavenia</code>
        nastav frekvenciu:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Týždenný report</strong> — každý pondelok 8:00 UTC (Vercel cron)</li>
        <li><strong>Mesačný report</strong> — 1. dňa v mesiaci 8:00 UTC</li>
        <li><strong>Off</strong> — bez emailov</li>
      </ul>
      <p>
        Email obsahuje: príjmy / výdavky / bilancia, top kategórie, najväčšie
        transakcie, medzimesačné zmeny, krátky Raul komentár, CTA „Otvoriť
        trezor". Všetko v parchment farebnej palete (light theme).
      </p>

      {/* 12 — Nastavenia */}
      <H2 id="nastavenia">12. ⚙️ Nastavenia účtu</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Meno</strong> — voliteľné, používa sa v oslovení v emailoch</li>
        <li><strong>Email notifikácie</strong> — toggle pre marketingové emaily (nie systémové)</li>
        <li><strong>Zmena hesla</strong> — vyžaduje súčasné heslo, po zmene všetky sessiony zaniknú</li>
        <li><strong>Export dát</strong> — JSON / CSV (GDPR data portability)</li>
        <li><strong>Vymazanie účtu</strong> — kompletne zmaže všetky tvoje dáta do 30 dní (GDPR right to be forgotten)</li>
      </ul>

      {/* 13 — Tipy */}
      <H2 id="tipy">13. ⌨️ Klávesové skratky a tipy</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <kbd className="font-mono text-xs bg-stone/60 border border-border-dim px-1.5 py-0.5 rounded">Enter</kbd>
          {' '} v kategórii uloží, <kbd className="font-mono text-xs bg-stone/60 border border-border-dim px-1.5 py-0.5 rounded">Esc</kbd> zruší
        </li>
        <li>Pretiahni PDF z Downloads priamo na dropzone — netreba klikať</li>
        <li>MonthPicker zobrazuje len mesiace v ktorých máš transakcie</li>
        <li>Hover nad kategóriou pri AI-set transakcii → uvidíš confidence %</li>
        <li>Hover nad popisom transakcie → uvidíš plný originál note (skrátený merchant zobrazí raw)</li>
      </ul>

      {/* 14 — Súkromie */}
      <H2 id="sukromie">14. 🛡 Súkromie a bezpečnosť</H2>
      <p>
        Tvoje finančné dáta nikomu nepredávame, nezdieľame ani neanalyzujeme
        cez tracking systémy. Detaily v:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>
          <Link to="/privacy" className="text-gold hover:text-gold-bright underline">
            Ochrana súkromia
          </Link>
          {' '} — čo zbierame, prečo, komu posielame, tvoje práva
        </li>
        <li>
          <Link to="/bezpecnost" className="text-gold hover:text-gold-bright underline">
            Bezpečnosť
          </Link>
          {' '} — PBKDF2, JWT, TLS, izolácia per user, open-source kód
        </li>
      </ul>
      <p>
        Stránka je open-source. Klonuj na GitHube{' '}
        <a
          href="https://github.com/martinbulak/Nulanaucte"
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold hover:text-gold-bright underline"
        >
          martinbulak/Nulanaucte
        </a>
        {' '} a hostuj sám ak nám nedôveruješ.
      </p>

      <p className="text-text-muted text-sm italic mt-8 pt-4 border-t border-border-dim">
        Niečo nefunguje alebo ti chýba feature? Napíš na{' '}
        <a href="mailto:bulak.martin@gmail.com" className="text-gold hover:text-gold-bright underline">
          bulak.martin@gmail.com
        </a>
        .
      </p>
    </InfoShell>
  )
}

function Toc({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a
        href={href}
        className="font-body text-text-secondary hover:text-gold-bright transition-colors"
      >
        {children}
      </a>
    </li>
  )
}
