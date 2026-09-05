require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const pgRoutes = require("./routes/pgs");
const bookingRoutes = require("./routes/bookings");

const app = express();

const PORT = 5000;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
  express.json()
);

app.use(
  cors()
);


// ============================================================
// ROUTES
// ============================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/pgs",
  pgRoutes
);

app.use(
  "/api/bookings",
  bookingRoutes
);


// ============================================================
// HEALTH CHECK
// ============================================================

/*app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      message:
        "PG Buddie backend is alive",

    });

  }
);*/
app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      message:
        "PG Buddie backend is alive",

      checkInRouteLoaded: true,

      serverMarker:
        "PG-BUDDIE-CHECKIN-2026-08-26",

    });

  }
);

// ============================================================
// DATABASE + SERVER
// ============================================================

mongoose
  .connect(
    process.env.MONGODB_URI
  )

  .then(() => {

    console.log(
      "MongoDB connected successfully"
    );


    app.listen(
      PORT,
      () => {

        console.log(
          `PG Buddie backend running at http://localhost:${PORT}`
        );

      }
    );

  })

  .catch(
    (error) => {

      console.error(
        "MongoDB connection failed"
      );

      console.error(
        error.message
      );

    }
  );