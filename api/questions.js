import { publicPaper } from "../lib/questions.js";

export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json(publicPaper());
}
