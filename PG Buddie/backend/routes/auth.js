const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();


// ============================================================
// REGISTER
// ============================================================

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      college
    } = req.body;


    // Basic validation
    if (
      !name ||
      !email ||
      !password ||
      !phone ||
      !role
    ) {
      return res.status(400).json({
        message:
          "Please fill in all required fields."
      });
    }


    // Only allow roles that our application supports
    if (
      !["student", "owner"].includes(role)
    ) {
      return res.status(400).json({
        message:
          "Invalid account type."
      });
    }


    // College is required for students
    if (
      role === "student" &&
      !college
    ) {
      return res.status(400).json({
        message:
          "University / College is required for students."
      });
    }


    // Check whether email already exists
    const existingUser =
      await User.findOne({
        email:
          email.toLowerCase().trim()
      });


    if (existingUser) {
      return res.status(409).json({
        message:
          "An account with this email already exists."
      });
    }


    // Hash the password before storing anything in MongoDB
    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );


    // Create the user
    const user =
      await User.create({
        name:
          name.trim(),

        email:
          email.toLowerCase().trim(),

        passwordHash,

        phone:
          phone.trim(),

        role,

        college:
          role === "student"
            ? college.trim()
            : undefined
      });


    return res.status(201).json({
      message:
        "Account created successfully.",

      user: {
        id:
          user._id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role
      }
    });


  } catch (error) {

    console.error(
      "Registration error:",
      error
    );


    return res.status(500).json({
      message:
        "Something went wrong while creating the account."
    });
  }
});


// ============================================================
// LOGIN
// ============================================================

router.post("/login", async (req, res) => {
  try {

    const {
      email,
      password,
      role
    } = req.body;


    if (
      !email ||
      !password ||
      !role
    ) {
      return res.status(400).json({
        message:
          "Email, password, and account type are required."
      });
    }


    if (
      !["student", "owner"].includes(role)
    ) {
      return res.status(400).json({
        message:
          "Invalid account type."
      });
    }


    const user =
      await User.findOne({
        email:
          email.toLowerCase().trim()
      });


    // Don't reveal whether an email exists.
    if (!user) {
      return res.status(401).json({
        message:
          "Invalid email or password."
      });
    }


    // Make sure the selected login role matches the account.
    if (
      user.role !== role
    ) {
      return res.status(401).json({
        message:
          "Invalid email or password."
      });
    }


    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash
      );


    if (!passwordMatches) {
      return res.status(401).json({
        message:
          "Invalid email or password."
      });
    }


    const token =
      jwt.sign(
        {
          userId:
            user._id.toString(),

          role:
            user.role
        },

        process.env.JWT_SECRET,

        {
          expiresIn:
            "7d"
        }
      );


    return res.status(200).json({

      message:
        "Login successful.",

      token,

      user: {

        id:
          user._id,

        name:
          user.name,

        email:
          user.email,

        role:
          user.role

      }

    });


  } catch (error) {

    console.error(
      "Login error:",
      error
    );


    return res.status(500).json({
      message:
        "Something went wrong while logging in."
    });
  }
});


// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

const authenticateToken =
  require("../middleware/auth");


// ============================================================
// CURRENT USER
// ============================================================
// GET /api/auth/me
// ============================================================

router.get(
  "/me",
  authenticateToken,
  async (req, res) => {

    try {

      const user =
        await User.findById(
          req.user.userId
        ).select(
          "-passwordHash"
        );


      if (!user) {
        return res.status(404).json({
          message:
            "User not found."
        });
      }


      return res.status(200).json({

        user: {

          id:
            user._id,

          name:
            user.name,

          email:
            user.email,

          role:
            user.role,

          phone:
            user.phone,

          college:
            user.college,

          /*
            Student booking cooldown.

            null means there is currently
            no active cooldown.
          */

          bookingCooldownUntil:
            user.bookingCooldownUntil

        }

      });


    } catch (error) {

      console.error(
        "Authentication check error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to verify user."
      });
    }
  }
);


module.exports =
  router;