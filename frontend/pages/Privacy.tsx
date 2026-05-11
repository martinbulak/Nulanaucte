import { Link } from 'react-router-dom'
import { InfoShell, H2, H3 } from '../components/layout/InfoShell'

export function Privacy() {
  return (
    <InfoShell
      eyebrow="✦ Pergamen ochrany ✦"
      title={
        <>
          Ochrana <span className="text-gold-bright">súkromia</span>
        </>
      }
    >
      <p className="italic text-text-secondary">
        Stručne a bez právnického hokus-pokusu — tu je všetko, čo o tebe ukladáme,
        prečo to ukladáme, a čo s tým môžeš spraviť.
      </p>

      <H2>1. Kto sme</H2>
      <p>
        <strong>Nula na účte</strong> je osobný projekt, nie firma. Aplikáciu vyvíja
        Martin Bulák ako open-source nástroj pre osobné financie. Kontakt:{' '}
        <a href="mailto:bulak.martin@gmail.com" className="text-gold hover:text-gold-bright underline">
          bulak.martin@gmail.com
        </a>.
      </p>

      <H2>2. Aké údaje ukladáme</H2>
      <H3>Účtové údaje</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li>Tvoj <strong>email</strong> (potrebný na prihlásenie a notifikácie).</li>
        <li>Tvoje <strong>meno</strong> (voliteľné, len pre oslovenie v emailoch).</li>
        <li>Tvoje <strong>heslo</strong> — neukladáme ho v čitateľnej podobe; uložíme len jednosmerný hash (PBKDF2, 600 000 iterácií).</li>
      </ul>
      <H3>Finančné údaje</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li>Transakcie z bankových výpisov, ktoré <em>ty sám</em> nahráš (PDF / CSV).</li>
        <li>Tvoje vlastné kategórie a manuálne úpravy.</li>
        <li>Hypotéky a investície, ktoré si zadáš.</li>
      </ul>
      <H3>Technické údaje</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li>IP adresu pri prihlásení (na rate-limiting a audit log).</li>
        <li>Časy posledného prihlásenia a poslednej aktivity.</li>
      </ul>
      <p className="text-text-secondary text-sm italic">
        Žiadne tracking cookies. Žiadne reklamné systémy. Žiadny Google Analytics.
      </p>

      <H2>3. Načo to potrebujeme</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Email + heslo</strong> — aby sa nikto iný nedostal do tvojho trezora.</li>
        <li><strong>Transakcie</strong> — aby sme ti vedeli ukázať grafy, kategórie a Raulove odporúčania.</li>
        <li><strong>IP + časy</strong> — aby sme zachytili útok hrubou silou na účet.</li>
      </ul>

      <H2>4. Komu to dávame</H2>
      <p>
        <strong>Nikomu, koho nepotrebujeme.</strong> Konkrétne tretie strany sú:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Neon.tech</strong> — kde leží šifrovaná Postgres databáza.</li>
        <li><strong>Vercel</strong> — kde beží samotná aplikácia.</li>
        <li><strong>Resend</strong> — kto pre nás posiela emaily (verify, reset, reporty).</li>
        <li><strong>OpenAI</strong> — kategorizácia transakcií a Raulove odporúčania. Posielame mu len <em>popis transakcie + sumu + dátum</em>, nikdy nie tvoje meno, číslo účtu ani heslo.</li>
      </ul>
      <p>
        Údaje nepredávame, neprenajímame, nezverejňujeme. Ak by sa stalo, že ich
        zákonom donútený vydať orgánom činným v trestnom konaní, urobíme to len v
        nevyhnutnom rozsahu.
      </p>

      <H2>5. Tvoje práva (GDPR)</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Právo na prístup</strong> — povedz nám a pošleme ti všetko, čo o tebe vieme.</li>
        <li><strong>Právo na opravu</strong> — väčšinu vecí si vieš opraviť priamo v aplikácii.</li>
        <li><strong>Právo na zabudnutie</strong> — napíš nám, zmažeme tvoj účet aj všetky transakcie do 30 dní.</li>
        <li><strong>Právo na prenosnosť</strong> — vieme ti exportovať všetko v JSON / CSV.</li>
      </ul>
      <p>
        Stačí napísať na{' '}
        <a href="mailto:bulak.martin@gmail.com" className="text-gold hover:text-gold-bright underline">
          bulak.martin@gmail.com
        </a>.
      </p>

      <H2>6. Bezpečnosť</H2>
      <p>
        Detailne v sekcii{' '}
        <Link to="/bezpecnost" className="text-gold hover:text-gold-bright underline">
          „Je to bezpečné?"
        </Link>
        . Stručne: heslá sú hashované, dáta sú izolované per používateľ, kód je
        verejne dostupný na GitHube, takže sa môžeš sám pozrieť, čo robíme.
      </p>

      <H2>7. Cookies</H2>
      <p>
        Používame jednu jedinú cookie — session token (HttpOnly, Secure, SameSite=Lax),
        aby si nemusel/a vždy znova zadávať heslo. Bez nej by aplikácia nefungovala.
        Žiadne tracking ani analytické cookies.
      </p>

      <H2>8. Zmeny</H2>
      <p>
        Ak sa táto stránka zmení, dáme ti vedieť emailom (ak máš overený email).
      </p>

      <p className="text-text-muted text-sm italic mt-8 pt-4 border-t border-border-dim">
        Posledná aktualizácia: 11. máj 2026
      </p>
    </InfoShell>
  )
}
