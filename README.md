# ProfClick

Il piano di lavoro del docente, lezione per lezione.

Metti l'orario e il programma delle tue classi: ProfClick ricava tutte le lezioni dell'anno
(festività e vacanze escluse), ti propone dove mettere spiegazioni e valutazioni per avere i
voti che servono in ogni periodo e ogni settimana ti dice cosa fare. Spunti quello che hai
fatto; se una lezione salta, il piano slitta da solo.

Pubblicato su **[profclick.federicodiluca.com](https://profclick.federicodiluca.com/)**, installabile
come app (PWA). Le decisioni di progetto sono in [docs/decisions](docs/decisions/).

## Come funziona

- **Anno scolastico già pronto**: quadrimestri o trimestre + pentamestre, festività nazionali
  e Pasqua calcolate. Si adattano al calendario della propria regione.
- **Classi**: l'orario con i giorni, oppure solo le lezioni della settimana in ordine con le
  loro ore; le ore in laboratorio o con l'ITP. Regola dei voti: di default uno per ogni ora
  settimanale, con almeno uno scritto, un orale e un pratico; ore di educazione civica.
- **Programma**: si incolla da una nota di Keep o da un documento. Capisce un elenco di
  argomenti, l'elenco dei voti ("1️⃣ Reti (scritto)", "✳️ Flipped classroom (orale, 30%)") e la
  lista dei prossimi passi ("⚠️ Scritto", "⬅️" dove sei arrivato).
- **Valutazioni previste** per argomento, con il loro peso; la proposta le mette in
  calendario, le prove pratiche nelle ore con l'ITP.
- **Da preparare**: slide, esercizi, laboratori, legati all'argomento; la settimana mostra
  quello che serve a breve.
- **Calendario**: "Aggiungi a Google Calendar" per ogni verifica, o un file .ics con tutte.
- **Proposta di piano** per periodo: argomenti e valutazioni sulle lezioni vuote, da applicare
  con un tocco.
- **Settimana**: cosa fare in ogni classe, spunta di fatto, avvisi sui voti mancanti.
- **Nessun server**: i dati stanno sul dispositivo e, se colleghi Google, in un file sul tuo
  Drive. Le modifiche fatte da più dispositivi si uniscono da sole. Nessun dato degli studenti.
  Dettagli nell'[informativa sulla privacy](https://profclick.federicodiluca.com/privacy/).
- **Installabile**: pulsante "Installa" che usa la finestra del browser dove c'è, e mostra le
  istruzioni passo passo su iPhone, iPad e Safari per Mac. Funziona offline e, quando esce una
  nuova versione, la propone.
- **Consiglia ProfClick**: in fondo alla pagina Anno, un'immagine pronta per le storie di
  Instagram passata al menu di condivisione del telefono (o scaricata).

## Sviluppo

Node 22.

```bash
npm install
npm run dev     # landing su http://localhost:5173/, app su /app/
npm test        # logica pura in src/core e motore di sincronizzazione
npm run lint
npm run build
npm run icons:build     # rigenera le icone da scripts/icon-source.svg
npm run social:build    # rigenera l'immagine di anteprima public/social-share.png
npm run story:build     # rigenera l'immagine per le storie di Instagram public/story.png
```

Stack: Vite, React, TypeScript, Tailwind, shadcn/ui (Radix), Vitest, oxlint, vite-plugin-pwa;
Google Identity Services e API REST di Drive chiamate dal browser, IndexedDB per i dati locali.

La sincronizzazione con Drive richiede un Client ID OAuth in `.env.local`:

```bash
VITE_GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
```

Senza Client ID l'app funziona solo sul dispositivo e il pulsante di Google non compare.

```text
index.html      landing pubblica (statica, indicizzabile)
app/index.html  l'app (PWA, noindex)
src/
  core/        logica pura e testata: calendario, voti, proposta, unione dei dati
  google/      login e chiamate a Drive
  state/       stato React e motore di sincronizzazione
  features/    settimana · classi · classe (piano, programma, voti, appunti) · anno
  components/  componenti condivisi e icone (ui/ = shadcn)
public/privacy/  informativa privacy (pagina statica)
docs/            decisioni (ADR) e logo per la schermata di consenso OAuth
```

### Deploy

Ogni push su `main` esegue [.github/workflows/deploy.yml](.github/workflows/deploy.yml):
lint, test e build, poi pubblicazione su GitHub Pages con dominio
`profclick.federicodiluca.com` ([public/CNAME](public/CNAME)).

## Autore

ProfClick è ideato e sviluppato da **[Federico Di Luca](https://federicodiluca.com/)**,
sviluppatore software e docente. Altri progetti su
**[federicodiluca.com/progetti](https://federicodiluca.com/progetti/)**.

Domande, segnalazioni o proposte: [profclick@federicodiluca.com](mailto:profclick@federicodiluca.com),
oppure apri una [issue](https://github.com/federicodiluca/profclick/issues).

## Licenza

[MIT](LICENSE) © Federico Di Luca
