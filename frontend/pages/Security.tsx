import { InfoShell, H2, H3 } from '../components/layout/InfoShell'

const GITHUB_URL = 'https://github.com/martinbulak/Nulanaucte'

export function Security() {
  return (
    <InfoShell
      eyebrow="✦ Pergamen bezpečnosti ✦"
      title={
        <>
          Je to <span className="text-gold-bright">bezpečné?</span>
        </>
      }
    >
      <p className="italic text-text-secondary">
        Tvoje finančné údaje sú citlivé. Tu je presne, ako ich chránime — a čo
        spravíš, ak nám nedôveruješ (spoiler: skopíruješ si kód a hostuješ to sám).
      </p>

      <H2>1. Krátka odpoveď</H2>
      <ul className="list-disc pl-6 space-y-1">
        <li>Heslá ukladáme len ako <strong>jednosmerné PBKDF2 hashy</strong> (600 000 iterácií). Aj keby niekto získal databázu, heslá sú nečitateľné.</li>
        <li>Každý používateľ vidí <strong>výlučne svoje vlastné dáta</strong> — server kontroluje vlastníctvo pri každom requeste.</li>
        <li>Komunikácia ide cez <strong>HTTPS</strong> (TLS 1.3) — nikto medzi tebou a serverom dáta nevidí.</li>
        <li>Session tokeny sú <strong>HttpOnly cookies</strong> — JavaScript v prehliadači sa k nim nedostane, takže XSS útok ti session neukradne.</li>
        <li>Kód je <strong>open-source</strong> — môžeš si ho prezrieť, overiť, hostovať vo vlastnej infraštruktúre.</li>
      </ul>

      <H2>2. Detailná odpoveď</H2>

      <H3>Heslá</H3>
      <p>
        Heslá hashujeme algoritmom <strong>PBKDF2-HMAC-SHA256</strong> s 600 000
        iteráciami a 32-bytovou náhodnou solou (cez Web Crypto API).
        Toto je odporúčaná konfigurácia od OWASP a NIST. Aj keby útočník získal
        celú databázu, prelomenie jedného hesla by mu trvalo desaťročia (ak je
        slušne dlhé).
      </p>

      <H3>Sessiony a JWT</H3>
      <p>
        Po prihlásení dostaneš JWT token podpísaný tajomstvom servera. Token je
        uložený v <strong>HttpOnly + Secure + SameSite=Lax cookie</strong>. To znamená:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Žiadny JavaScript v prehliadači ho nevidí (ochrana proti XSS).</li>
        <li>Posiela sa len cez HTTPS (ochrana proti MITM).</li>
        <li>Neposiela sa pri cross-site requestoch (ochrana proti CSRF).</li>
        <li>Server vie session kedykoľvek <strong>zneplatniť</strong> (cez tokenVersion v DB) — napríklad keď zmeníš heslo.</li>
      </ul>

      <H3>Izolácia používateľov</H3>
      <p>
        Každá tabuľka v databáze obsahuje stĺpec <code className="text-gold font-mono text-sm">user_id</code>.
        Každá API operácia začína overením, že prihlásený používateľ je vlastníkom
        objektu (banka, transakcia, kategória, hypotéka). Pokus o IDOR útok
        (zmena ID v URL) skončí 404.
      </p>

      <H3>Ochrana proti útokom</H3>
      <ul className="list-disc pl-6 space-y-1">
        <li><strong>Rate limiting</strong> — login: 5 pokusov / 15 min na IP. Reset hesla: 3 / hodinu. AI: 30 / hodinu na používateľa.</li>
        <li><strong>Input validácia</strong> — všetko cez Zod schémy, žiadne `eval`, žiadne SQL injection (Drizzle ORM).</li>
        <li><strong>HTTPS-only cookies</strong> v produkcii.</li>
        <li><strong>Brute-force ochrana</strong> — pomalé hashovanie hesiel + rate-limit + audit log.</li>
      </ul>

      <H3>Šifrovanie v pokoji</H3>
      <p>
        Databáza beží na <strong>Neon.tech</strong> (managed Postgres) s
        full-disk encryption (AES-256) a šifrovanou replikáciou. Backupy sú tiež
        šifrované.
      </p>

      <H3>OpenAI a citlivé údaje</H3>
      <p>
        Keď stláčaš „Roztriediť výdavky kúzlom" alebo „Spýtať sa Raula",
        posielame OpenAI <strong>iba popis transakcie, sumu a dátum</strong>.
        Nikdy neposielame:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Tvoje meno, email, heslo.</li>
        <li>Číslo účtu, IBAN, BIC.</li>
        <li>Identifikátory protistrán (okrem názvu obchodu, ktorý je už súčasťou popisu).</li>
      </ul>
      <p>
        OpenAI má v zmluve, že <strong>nepoužíva</strong> API requesty na trénovanie modelov.
      </p>

      <H2>3. Prečo nám môžeš dôverovať</H2>
      <p>
        Lebo nemusíš. <strong>Celý kód aplikácie je verejne dostupný</strong> na GitHube:
      </p>
      <p>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block font-heading text-sm uppercase tracking-widest text-ink bg-gradient-to-br from-gold-bright via-gold to-gold-dim px-5 py-2.5 rounded-[3px] [box-shadow:0_2px_8px_rgba(201,151,42,0.3)] hover:-translate-y-px transition-all duration-200 no-underline"
        >
          ⚡ github.com/martinbulak/Nulanaucte
        </a>
      </p>
      <p>
        Môžeš si prezrieť každý riadok kódu. Môžeš sa pozrieť, ako presne
        spracúvame heslá, ako overujeme vlastníctvo dát, čo presne posielame OpenAI.
        Ak nájdeš chybu, nahlás ju (alebo rovno pošli pull request).
      </p>

      <H2>4. Self-host (vlastný server)</H2>
      <p>
        Ak chceš mať <strong>plnú kontrolu</strong> nad svojimi dátami, môžeš si
        aplikáciu nasadiť vo vlastnej infraštruktúre. Postup je v README:
      </p>
      <ol className="list-decimal pl-6 space-y-1">
        <li>Klonuj repo: <code className="text-gold font-mono text-sm">git clone {GITHUB_URL}</code></li>
        <li>Vytvor si Postgres databázu (Neon, Supabase, lokálny Docker, Hetzner...).</li>
        <li>Nastav environment variables (.env): <code className="text-gold font-mono text-sm">DATABASE_URL, JWT_SECRET, OPENAI_API_KEY, RESEND_API_KEY</code>.</li>
        <li>Spusti migrácie: <code className="text-gold font-mono text-sm">npm run db:push</code></li>
        <li>Nasadi na Vercel, Railway, Fly.io, alebo VPS — všetko funguje.</li>
      </ol>
      <p className="italic text-text-secondary">
        Pri self-hoste si jediný správca svojej DB — nikto iný (vrátane mňa) nemá
        prístup k tvojim dátam.
      </p>

      <H2>5. Čo (zatiaľ) nemáme</H2>
      <p className="italic text-text-secondary">
        Buďme úprimní — toto je vec, na ktorej sa stále pracuje:
      </p>
      <ul className="list-disc pl-6 space-y-1">
        <li>Dvojfaktorové overenie (TOTP) — plánované.</li>
        <li>End-to-end šifrovanie transakcií — plánované, vyžaduje rozhodnutie o UX.</li>
        <li>SOC 2 / ISO 27001 audit — pre osobný projekt nereálne, ale otvorenosť kódu je solídna náhrada.</li>
      </ul>

      <H2>6. Hlásenie zraniteľností</H2>
      <p>
        Ak nájdeš bezpečnostnú chybu, prosím <strong>neoznamuj ju verejne</strong>.
        Napíš mi priamo na{' '}
        <a href="mailto:bulak.martin@gmail.com" className="text-gold hover:text-gold-bright underline">
          bulak.martin@gmail.com
        </a>
        {' '}— odpoviem do 48 hodín a opravím tak rýchlo, ako sa dá.
      </p>
    </InfoShell>
  )
}
