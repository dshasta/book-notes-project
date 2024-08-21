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
        review_body_for_display: review.review_body, // Rendered review body
        date_read: review.date_read,
        submission_date: review.submission_date,
        starRating: getStars(review.rating), // Add the starRating for each review
        coverImage: review.coverImage // Pass the cover image URL
      };
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

// GET route for displaying the New Review form
app.get("/new-review", (req, res) => {
  res.render("new_review.ejs", {
    pageTitle: "New Review" // You can set the page title here
  });
});

// POST route to handle the new review form submission and add the review to the database
app.post("/add", async (req, res) => {
  let { username, title, author, isbn13, rating, reviewBody, date_read } = req.body;

  // Server-side validation for required fields
  if (!username || !title || !author || !isbn13 || !rating || !reviewBody || !date_read) {
    return res.status(400).send("All fields are required.");
  }

  // Validate that the ISBN is exactly 13 digits
  const isbn13Regex = /^\d{13}$/;
  if (!isbn13Regex.test(isbn13)) {
    return res.status(400).send("ISBN must be exactly 13 digits with no spaces or dashes.");
  }

  // Validate that the rating is between 1 and 5
  const validRatings = [1, 2, 3, 4, 5];
  if (!validRatings.includes(parseInt(rating, 10))) {
    return res.status(400).send("Rating must be a number between 1 and 5.");
  }

  // Validate that the review body does not exceed the maximum character limit (1000)
  if (reviewBody.length > 1000) {
    return res.status(400).send("Review body cannot exceed 1000 characters.");
  }

  // Convert line breaks (\n) to <br> tags for proper display in the database
  reviewBody = reviewBody.replace(/\n/g, "<br>");

  try {
    const query = `
      INSERT INTO reviews (username, title, author, isbn13, rating, review_body, date_read) 
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await db.query(query, [username, title, author, isbn13, rating, reviewBody, date_read]);

    res.redirect("/"); // Redirect to the homepage after adding the review
  } catch (error) {
    console.error("Error adding new review:", error);
    res.status(500).send("An error occurred while adding the new review.");
  }
});



// GET route for the individual book review page
app.get("/reviews/:id", async (req, res) => {
  const reviewId = parseInt(req.params.id, 10); // Ensure the ID is treated as an integer
  try {
    const result = await db.query("SELECT * FROM reviews WHERE id = $1", [reviewId]);
    const review = result.rows[0];
    if (review) {
      const coverUrl = `https://covers.openlibrary.org/b/isbn/${review.isbn13}-L.jpg`;
      try {
        const response = await axios.get(coverUrl);
        if (response.status === 200) {
          review.coverImage = coverUrl;
        } else {
          review.coverImage = 'default-cover.jpg';
        }
      } catch (err) {
        review.coverImage = 'default-cover.jpg';
      }

      review.starRating = getStars(review.rating);

      // Pass review_body to display as HTML safely
      res.render("book_view.ejs", {
        pageTitle: `${review.title} - ${review.author}`,
        review: {
          ...review,
          review_body_for_display: review.review_body // Rendered review body as HTML
        }
      });
    } else {
      res.status(404).send("Review not found");
    }
  } catch (error) {
    console.error("Error fetching review:", error);
    res.status(500).send("An error occurred while fetching the review.");
  }
});


// Delete review route
app.post("/delete-review/:id", async (req, res) => {
  const reviewId = req.params.id;

  try {
    const query = "DELETE FROM reviews WHERE id = $1";
    await db.query(query, [reviewId]);
    res.redirect("/"); // After deletion, redirect back to the homepage
  } catch (error) {
    console.error("Error deleting review:", error);
    res.status(500).send("An error occurred while deleting the review.");
  }
});

// GET route to display the edit form with pre-filled review data
app.get("/edit-review/:id", async (req, res) => {
  const reviewId = req.params.id;
  try {
    const query = "SELECT * FROM reviews WHERE id = $1";
    const result = await db.query(query, [reviewId]);

    if (result.rows.length === 0) {
      return res.status(404).send("Review not found");
    }

    const review = result.rows[0];

    // Replace <br> with \n for proper display in the text area
    review.review_body = review.review_body.replace(/<br>/g, '\n');

    res.render("edit_review.ejs", {
      pageTitle: "Edit Review",
      review: review
    });
  } catch (error) {
    console.error("Error fetching review for editing:", error);
    res.status(500).send("An error occurred while fetching the review.");
  }
});


// POST route to handle the edit form submission and update the review in the database
app.post("/edit-review/:id", async (req, res) => {
  const reviewId = req.params.id;
  let { username, title, author, isbn13, rating, reviewBody, date_read } = req.body;

  try {
    // Replace newlines with <br> for proper display in HTML
    reviewBody = reviewBody.replace(/\n/g, '<br>');

    const query = `
      UPDATE reviews 
      SET username = $1, title = $2, author = $3, isbn13 = $4, rating = $5, review_body = $6, date_read = $7
      WHERE id = $8
    `;
    await db.query(query, [username, title, author, isbn13, rating, reviewBody, date_read, reviewId]);

    res.redirect(`/reviews/${reviewId}`); // Redirect to the book view page after editing
  } catch (error) {
    console.error("Error updating review:", error);
    res.status(500).send("An error occurred while updating the review.");
  }
});


// Start the server
const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


