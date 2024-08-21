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


function getStars(rating) {
  let stars = '';
  for (let i = 1; i <= 5; i++) {
    stars += (i <= rating) ? '★' : '☆';
  }
  return stars;
}

// GET route to display the reviews with star ratings
app.get("/", async (req, res) => {
  try {
    let query = "SELECT * FROM reviews";
    const sort = req.query.sort;

    // Sorting logic based on the query parameter
    if (sort === "newest") {
      query += " ORDER BY date_read DESC";
    } else if (sort === "best") {
      query += " ORDER BY rating DESC";
    } else if (sort === "title") {
      query += " ORDER BY title ASC";
    } else {
      // Default sorting by date (newest first)
      query += " ORDER BY date_read DESC";
    }

    const reviews = (await db.query(query)).rows;

    // Loop through each review and fetch the cover image using Axios
    for (let review of reviews) {
      const coverUrl = `https://covers.openlibrary.org/b/isbn/${review.isbn13}-M.jpg`; // Adjusted to M size
      try {
        const response = await axios.get(coverUrl);
        if (response.status === 200) {
          review.coverImage = coverUrl;
        } else {
          review.coverImage = "default-cover.jpg"; // Fallback image
        }
      } catch (err) {
        console.error(`Error fetching cover for ISBN ${review.isbn13}:`, err);
        review.coverImage = "default-cover.jpg"; // Fallback in case of error
      }
    }

    // Add the star rating for each review
    const reviewsWithStars = reviews.map((review) => {
      return {
        id: review.id,
        username: review.username,
        title: review.title,
        author: review.author,
        isbn13: review.isbn13,
        rating: review.rating,
        review_body: review.review_body,
        date_read: review.date_read,
        submission_date: review.submission_date,
        starRating: getStars(review.rating), // Add the starRating for each review
        coverImage: review.coverImage // Pass the cover image URL
      };
    });

    app.get('/new-review', (req, res) => {
      res.render('new-review.ejs', { pageTitle: 'New Review' });
    });

    // Render the index.ejs template with reviews_list
    res.render("index.ejs", {
      pageTitle: "Book Reviews",
      reviews_list: reviewsWithStars
    });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    res.status(500).send("An error occurred while fetching reviews.");
  }
});

// Start the server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});