# Decisioni architetturali

Ogni file registra una decisione: il contesto, cosa si è scelto, le alternative scartate e le
conseguenze. Formato ADR ([Architecture Decision Record](https://adr.github.io/)), in breve.
Una decisione superata non si cancella: si scrive un nuovo ADR che la sostituisce.

| # | Decisione | Stato |
| --- | --- | --- |
| [0001](0001-local-first-login-facoltativo.md) | App statica local-first, login Google facoltativo | Accettata |
| [0002](0002-stack.md) | Stack: React, Vite, shadcn/ui, wouter con indirizzi # | Accettata |
| [0003](0003-drive-e-unione.md) | Dati su IndexedDB e Drive, unione record per record | Accettata |
| [0004](0004-modello-dati.md) | Modello: lezioni ricavate dall'orario, piano salvato solo dove c'è | Accettata |
| [0005](0005-voti.md) | Voti della classe, non degli studenti | Accettata |
| [0006](0006-proposta-di-piano.md) | Proposta di piano, applicata solo su conferma | Accettata |
| [0007](0007-seo.md) | Pagina pubblica indicizzabile sul sottodominio, app sotto /app/ | Accettata |
| [0008](0008-orario-flessibile.md) | Orario con i giorni, o solo le lezioni in ordine; ore con ITP | Accettata |
| [0009](0009-calendario-e-preparazione.md) | Verifiche sul calendario senza permessi; materiale da preparare | Accettata |
| [0010](0010-orario-che-cambia.md) | Orario che cambia da una data; argomenti e voti spuntati senza lezione | Accettata |
| [0011](0011-riunioni.md) | Riunioni con le cose da preparare e il riepilogo della classe | Accettata |
