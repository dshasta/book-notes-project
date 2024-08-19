import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import axios from "axios";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = 3000;

const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "book_notes",
  password: "abc123*",
  port: 5432,
});
db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", async (req, res) => {
  
  res.render("index.ejs", {
    pageTitle: "Book Reviews",
  });
});

app.get('/new-review', (req, res) => {
  res.render('new-review.ejs', { pageTitle: 'New Review' });
});





// Start the server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});