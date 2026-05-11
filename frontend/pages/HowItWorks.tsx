import { Link } from 'react-router-dom'
import { InfoShell, H2 } from '../components/layout/InfoShell'

export function HowItWorks() {
  return (
    <InfoShell
      eyebrow="✦ Pergamen návodu ✦"
      title={
        <>
          Ako to <span className="text-gold-bright">funguje</span>
        </>
      }
    >
      <p className="italic text-text-secondary">
        Cieľ je jednoduchý: za pár minút uvidíš, kam ti reálne miznú peniaze —
        bez ručného zapisovania transakcií do excelu.
      </p>

      <H2>1. ⚡ Zaregistruješ sa</H2>
      <p>
        Email + heslo, potvrdíš si email cez sovu (link, ktorý ti príde do
        schránky). Účet je len tvoj — nikto z agentúry, banky ani úradu sa doň
        nepozrie.
      </p>

      <H2>2. 🏦 Pridáš si banky</H2>
      <p>
        V sekcii <strong>Banky</strong> si vytvoríš účty, ktoré chceš sledovať
        (napr. „SLSP bežný", „Tatra hypotekárny"). Slúži to len na rozdelenie
        transakcií podľa zdroja — žiadne prihlasovanie do internet bankingu,
        žiadne API kľúče, žiadny prístup k tvojim peniazom.
      </p>

      <H2>3. 📜 Naimportuješ výpis</H2>
      <p>
        Stiahneš si <strong>PDF alebo CSV výpis</strong> zo svojej banky a
        pretiahneš ho do aplikácie. Aplikácia rozpozná formát SLSP, Tatra Banky,
        VÚB, ČSOB a ďalších a transakcie naparsuje.
      </p>
      <p className="italic text-text-secondary text-sm">
        Tip: aj historické výpisy fungujú. Môžeš naimportovať aj rok dozadu naraz.
      </p>

      <H2>4. 🔮 AI roztriedi výdavky</H2>
      <p>
        Klikneš na <strong>„Roztriediť výdavky kúzlom"</strong> a AI (GPT-4o-mini)
        každú transakciu zaradí do kategórie:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li><em>Potraviny, Reštaurácie, Doprava, Nájom, Energie, Zdravie, Zábava...</em></li>
        <li>Kategórie sú voľné — AI vymyslí novú, ak sa hodí.</li>
        <li>Ak sa ti niečo nezdá, klikneš na kategóriu a prepíšeš ju ručne. AI si pamätá tvoje opravy pre nabudúce.</li>
      </ul>

      <H2>5. 📊 Pozeráš grafy</H2>
      <p>
        Na <strong>Dashboarde</strong> uvidíš:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Príjmy vs. výdavky vs. bilancia za mesiac.</li>
        <li>Top 5 kategórií, kde najviac míňaš.</li>
        <li>Najväčšie jednorazové transakcie (na čo padli).</li>
        <li>Porovnanie s minulým mesiacom — kde si zaprel a kde rozjebal.</li>
      </ul>

      <H2>6. 🪄 Spýtaš sa Raula</H2>
      <p>
        <strong>Raul</strong> je veštec z komnaty galeónov — AI komentátor, ktorý
        sa pozrie na tvoje výdavky a napíše krátku správu typu:
      </p>
      <blockquote className="border-l-2 border-gold/40 pl-4 italic text-text-secondary my-3">
        „Tento mesiac si v reštauráciách nechal o 38 % viac ako minulý.
        Konkrétne ten obed za 47 € v sobotu nebol nutný. Sústrediť sa
        budúci týždeň na varenie doma a ušetríš ~120 €."
      </blockquote>
      <p>
        Bez moralizovania, bez bullshit-tipov typu „nepi kávu z baristov".
        Konkrétne, na základe tvojich reálnych čísel.
      </p>

      <H2>7. 🦉 Sova ti raz za týždeň pošle výpis</H2>
      <p>
        V <strong>Nastaveniach</strong> si zapneš týždenný alebo mesačný report
        emailom. Sova ti ho automaticky pošle v nedeľu večer alebo prvý deň
        mesiaca — kompletný výpis s kategóriami a Raulovým komentárom.
      </p>

      <H2>8. 🏠 Hypotéky a investície (voliteľné)</H2>
      <p>
        V sekcii <strong>Hypotéky</strong> si môžeš zadať svoje dlhodobé záväzky
        a aplikácia ti spočíta zostatok, úroky a kedy reálne dosplácaš. To isté
        pre investície (sporenie, ETF).
      </p>

      <H2>9. 🔐 Tvoje dáta zostávajú tvoje</H2>
      <p>
        V <strong>Nastaveniach</strong> si môžeš kedykoľvek:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Stiahnuť všetky svoje dáta v JSON / CSV.</li>
        <li>Zmazať účet aj so všetkými transakciami.</li>
        <li>Zmeniť heslo (všetky prihlásené sessiony sa okamžite zneplatnia).</li>
      </ul>
      <p>
        Detaily o tom, ako chránime tvoje dáta, sú v sekcii{' '}
        <Link to="/bezpecnost" className="text-gold hover:text-gold-bright underline">
          „Je to bezpečné?"
        </Link>
        {' '}a v{' '}
        <Link to="/privacy" className="text-gold hover:text-gold-bright underline">
          ochrane súkromia
        </Link>.
      </p>

      <H2>To je všetko ✦</H2>
      <p>
        Žiadne 30-dňové triály, žiadne predplatné, žiadne reklamy. Aplikácia je
        zadarmo, kód je open-source.
      </p>
      <p className="text-center mt-6">
        <Link
          to="/register"
          className="inline-block font-heading text-sm uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-6 py-3 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200 no-underline"
        >
          ⚡ Otvoriť trezor
        </Link>
      </p>
    </InfoShell>
  )
}
