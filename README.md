# QueryForge

QueryForge è una piattaforma per esercitarsi con il linguaggio SQL tramite un'interfaccia web. Il progetto è suddiviso in tre componenti principali:

- **Backend** Node.js/Express (cartella `backend`)
- **Frontend** Vue.js (cartella `frontend`)
- **Database** MySQL gestito con Docker

## Setup rapido

### Prerequisiti

- Node.js \(>= 16\)
- Docker e docker-compose

### 1. Avvio del database

Il file `docker-compose.yml` configura un'istanza MySQL e phpMyAdmin. Per avviare i container eseguire:

```bash
docker-compose up -d
```

Il database sarà accessibile sulla porta `3307`, mentre phpMyAdmin sulla `8080`.

### 2. Installazione e avvio del backend

```bash
cd backend
npm install            # installa le dipendenze
npm start              # avvia in modalita' produzione
# oppure per lo sviluppo:
npm run dev            # avvia con nodemon
```

Copiare `backend/.env.example` in `backend/.env` e sostituire i valori di esempio (password del database, chiavi JWT, casella email). Il file `.env` non va mai committato.

### 3. Installazione e avvio del frontend

```bash
cd frontend
npm install            # installa le dipendenze
npm run serve          # avvia il server di sviluppo
# build di produzione:
npm run build
```

## Comandi principali

- `npm start` – avvia il backend (o, se eseguito in altre cartelle, lo script definito nello `package.json`)
- `npm run dev` – avvio del backend con ricaricamento automatico
- `npm run serve` – avvia il frontend tramite Vite
- `npm run build` – genera la build ottimizzata del frontend
- `npm run preview` – serve localmente la build prodotta

## Esecuzione dei test con Jest

I test sono collocati nella cartella `__tests__` e utilizzano Jest.
Per eseguirli installare Jest nelle dipendenze di sviluppo e lanciare:

```bash
npx jest
```

In alternativa è possibile aggiungere lo script `"test": "jest"` nel `package.json` e quindi usare `npm test`
