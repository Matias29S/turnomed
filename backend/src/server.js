import { createApp } from './app.js';
import { assertConfig, config } from './config.js';

assertConfig();

const app = createApp();

app.listen(config.port, () => {
  console.log(`TurnoMed API escuchando en http://localhost:${config.port}`);
});
