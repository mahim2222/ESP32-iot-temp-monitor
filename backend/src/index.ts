import express, { Request, Response } from 'express';

const app = express();
const PORT = 4000;

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, Express server is running!');
})

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});