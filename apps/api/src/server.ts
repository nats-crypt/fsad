import { createApp } from "./app.js";

const port = process.env.PORT ?? 4000;

createApp().listen(port, () => {
  console.log(`Horizon API listening on http://localhost:${port}`);
});
