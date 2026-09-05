const express = require("express");
const mongoose = require("mongoose");

const PG = require("../models/PG");
const Room = require("../models/Room");
const authenticateToken = require("../middleware/auth");

const router = express.Router();


// ============================================================
// DISTANCE BETWEEN TWO GPS COORDINATES
// ============================================================
//
// Returns distance in kilometres.
//
// Uses the Haversine formula.
// ============================================================

function calculateDistanceKm(
  latitude1,
  longitude1,
  latitude2,
  longitude2
) {

  const toRadians =
    degrees =>
      degrees *
      (Math.PI / 180);


  const earthRadiusKm =
    6371;


  const dLatitude =
    toRadians(
      latitude2 -
      latitude1
    );


  const dLongitude =
    toRadians(
      longitude2 -
      longitude1
    );


  const lat1 =
    toRadians(
      latitude1
    );


  const lat2 =
    toRadians(
      latitude2
    );


  const a =
    Math.sin(
      dLatitude / 2
    ) ** 2 +

    Math.cos(lat1) *
    Math.cos(lat2) *
    Math.sin(
      dLongitude / 2
    ) ** 2;


  const c =
    2 *
    Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );


  return (
    earthRadiusKm *
    c
  );

}


// ============================================================
// OWNER-ONLY MIDDLEWARE
// ============================================================

function requireOwner(req, res, next) {

  if (req.user.role !== "owner") {

    return res.status(403).json({
      message: "Owner access required.",
    });

  }

  next();
}


// ============================================================
// ROOM TYPE VALIDATION
// ============================================================

function validateRoomTypes(roomTypes) {

  if (!Array.isArray(roomTypes)) {

    return {
      valid: false,
      message:
        "Room configuration must be an array.",
    };

  }


  if (roomTypes.length === 0) {

    return {
      valid: false,
      message:
        "At least one room-sharing type is required.",
    };

  }


  for (const roomType of roomTypes) {

    // --------------------------------------------------------
    // SHARING
    // --------------------------------------------------------

    const sharing =
      Number(
        roomType.sharing
      );


    if (
      !Number.isInteger(sharing) ||
      sharing < 1
    ) {

      return {
        valid: false,
        message:
          "Every room-sharing value must be a whole number greater than 0.",
      };

    }


    // --------------------------------------------------------
    // ROOM COUNT
    // --------------------------------------------------------

    const roomCount =
      Number(
        roomType.roomCount
      );


    if (
      !Number.isInteger(roomCount) ||
      roomCount < 1
    ) {

      return {
        valid: false,
        message:
          "Every room type must contain at least one room.",
      };

    }


    // --------------------------------------------------------
    // ROOM-TYPE RENT
    // --------------------------------------------------------

    const roomRent =
      Number(
        roomType.rent
      );


    if (
      !Number.isFinite(roomRent) ||
      roomRent < 0
    ) {

      return {
        valid: false,
        message:
          "Every room type must have a valid monthly rent.",
      };

    }


    // --------------------------------------------------------
    // NAMING STYLE
    // --------------------------------------------------------

    const namingStyle =
      roomType.namingStyle ||
      "number";


    if (
      ![
        "number",
        "prefix-number",
        "later",
      ].includes(
        namingStyle
      )
    ) {

      return {
        valid: false,
        message:
          "Invalid room naming style.",
      };

    }


    // --------------------------------------------------------
    // NAME LATER
    // --------------------------------------------------------

    if (
      namingStyle === "later"
    ) {

      continue;

    }


    // --------------------------------------------------------
    // START NUMBER
    // --------------------------------------------------------

    const startNumber =
      Number(
        roomType.startNumber
      );


    if (
      !Number.isInteger(
        startNumber
      ) ||
      startNumber < 0
    ) {

      return {
        valid: false,
        message:
          "A valid starting room number is required for every generated room type.",
      };

    }


    // --------------------------------------------------------
    // PREFIX + NUMBER
    // --------------------------------------------------------

    if (
      namingStyle ===
      "prefix-number"
    ) {

      const prefix =
        String(
          roomType.prefix ||
          ""
        ).trim();


      if (!prefix) {

        return {
          valid: false,
          message:
            "A prefix is required for Prefix + numbers room naming.",
        };

      }


      if (
        prefix.length > 20
      ) {

        return {
          valid: false,
          message:
            "Room prefix cannot be longer than 20 characters.",
        };

      }

    }

  }


  return {
    valid: true,
  };

}


// ============================================================
// CALCULATE PG TOTALS
// ============================================================

function calculateRoomTotals(
  roomTypes
) {

  let totalRooms = 0;

  let capacity = 0;


  for (
    const roomType of roomTypes
  ) {

    const sharing =
      Number(
        roomType.sharing
      );


    const roomCount =
      Number(
        roomType.roomCount
      );


    totalRooms +=
      roomCount;


    capacity +=
      sharing *
      roomCount;

  }


  return {
    totalRooms,
    capacity,
  };

}


// ============================================================
// GENERATE ROOM NAMES
// ============================================================

function generateRoomNames(
  roomType
) {

  const roomCount =
    Number(
      roomType.roomCount
    );


  const namingStyle =
    roomType.namingStyle ||
    "number";


  // ----------------------------------------------------------
  // NAME LATER
  // ----------------------------------------------------------

  if (
    namingStyle === "later"
  ) {

    return Array.from(
      {
        length:
          roomCount,
      },

      (_, index) =>
        `Room ${index + 1}`
    );

  }


  // ----------------------------------------------------------
  // START NUMBER
  // ----------------------------------------------------------

  const startNumber =
    Number(
      roomType.startNumber
    );


  // ----------------------------------------------------------
  // PREFIX
  // ----------------------------------------------------------

  const prefix =
    namingStyle ===
    "prefix-number"

      ? String(
          roomType.prefix ||
          ""
        ).trim()

      : "";


  // ----------------------------------------------------------
  // GENERATE
  // ----------------------------------------------------------

  return Array.from(
    {
      length:
        roomCount,
    },

    (_, index) =>
      `${prefix}${startNumber + index}`
  );

}


// ============================================================
// CHECK DUPLICATE ROOM NAMES
// ============================================================

function validateGeneratedRoomNames(
  roomTypes
) {

  const usedNames =
    new Set();


  for (
    const roomType of roomTypes
  ) {

    const roomNames =
      generateRoomNames(
        roomType
      );


    for (
      const roomName of roomNames
    ) {

      const normalizedName =
        roomName
          .trim()
          .toLowerCase();


      if (
        usedNames.has(
          normalizedName
        )
      ) {

        return {
          valid: false,

          message:
            `Duplicate room name "${roomName}". Please choose a different room range or prefix.`,
        };

      }


      usedNames.add(
        normalizedName
      );

    }

  }


  return {
    valid: true,
  };

}


// ============================================================
// CREATE PG
// ============================================================
// POST /api/pgs
// ============================================================

router.post(
  "/",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      const {
        name,
        description,
        address,
        city,
        amenities,
        roomTypes,
        gender,
        phone,
        images,
        location,
      } = req.body;


      // ------------------------------------------------------
      // BASIC VALIDATION
      // ------------------------------------------------------

      if (
        !name ||
        !address ||
        !city
      ) {

        return res.status(400).json({
          message:
            "Name, address, and city are required.",
        });

      }


      // ------------------------------------------------------
      // ROOM TYPE VALIDATION
      // ------------------------------------------------------

      const roomValidation =
        validateRoomTypes(
          roomTypes
        );


      if (
        !roomValidation.valid
      ) {

        return res.status(400).json({
          message:
            roomValidation.message,
        });

      }


      // ------------------------------------------------------
      // CALCULATE TOTALS
      // ------------------------------------------------------

      const {
        totalRooms,
        capacity,
      } =
        calculateRoomTotals(
          roomTypes
        );


      if (
        totalRooms <= 0 ||
        capacity <= 0
      ) {

        return res.status(400).json({
          message:
            "Room configuration must contain at least one room.",
        });

      }


      // ------------------------------------------------------
      // GENERATE ROOM NAMES
      // ------------------------------------------------------

      const roomNameValidation =
        validateGeneratedRoomNames(
          roomTypes
        );


      if (
        !roomNameValidation.valid
      ) {

        return res.status(400).json({
          message:
            roomNameValidation.message,
        });

      }


      // ------------------------------------------------------
      // BUILD NORMALIZED ROOM TYPES
      // ------------------------------------------------------

      const normalizedRoomTypes =
        roomTypes.map(
          (roomType) => {

            const namingStyle =
              roomType.namingStyle ||
              "number";


            return {

              sharing:
                Number(
                  roomType.sharing
                ),


              roomCount:
                Number(
                  roomType.roomCount
                ),


              // Rent belongs to THIS room type.

              rent:
                Number(
                  roomType.rent
                ),


              namingStyle,


              prefix:
                namingStyle ===
                "prefix-number"

                  ? String(
                      roomType.prefix ||
                      ""
                    ).trim()

                  : "",


              startNumber:
                namingStyle ===
                "later"

                  ? null

                  : Number(
                      roomType.startNumber
                    ),

            };

          }
        );


      // ------------------------------------------------------
      // ALL BEDS START AVAILABLE
      // ------------------------------------------------------

      const availableBeds =
        capacity;


      // ------------------------------------------------------
      // CREATE PG
      // ------------------------------------------------------

      const pg =
        await PG.create({

          name,

          description,

          address,

          city,

          owner:
            req.user.userId,

          amenities,

          roomTypes:
            normalizedRoomTypes,

          totalRooms,

          capacity,

          availableBeds,

          gender,

          phone,

          images,

          location,

        });


      // ======================================================
      // CREATE INDIVIDUAL ROOMS
      // ======================================================

      /*
        IMPORTANT:

        Every individual Room gets its
        rent from its own room type.

        Example:

        5-share → ₹6000

        A-101 → ₹6000
        A-102 → ₹6000

        4-share → ₹7000

        B-201 → ₹7000
        B-202 → ₹7000
      */

      const roomsToCreate =
        [];


      for (
        const roomType of
        normalizedRoomTypes
      ) {

        const sharing =
          Number(
            roomType.sharing
          );


        const roomRent =
          Number(
            roomType.rent
          );


        const roomNames =
          generateRoomNames(
            roomType
          );


        for (
          const roomName of
          roomNames
        ) {

          roomsToCreate.push({

            pg:
              pg._id,


            roomNumber:
              roomName,


            sharingType:
              sharing,


            // THIS IS THE IMPORTANT PART.

            rent:
              roomRent,


            capacity:
              sharing,


            occupiedBeds:
              0,


            status:
              "available",

          });

        }

      }


      // ------------------------------------------------------
      // SAFETY CHECK
      // ------------------------------------------------------

      if (
        roomsToCreate.length !==
        totalRooms
      ) {

        await PG.deleteOne({
          _id:
            pg._id,
        });


        return res.status(500).json({
          message:
            "Room generation failed. PG was not created.",
        });

      }


      // ------------------------------------------------------
      // INSERT ROOMS
      // ------------------------------------------------------

      const createdRooms =
        await Room.insertMany(
          roomsToCreate
        );


      // ------------------------------------------------------
      // RESPONSE
      // ------------------------------------------------------

      return res.status(201).json({

        message:
          "PG and rooms created successfully.",

        pg,

        rooms:
          createdRooms,

      });


    } catch (error) {

      console.error(
        "Create PG error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to create PG.",
      });

    }

  }
);


// ============================================================
// GET OWNER'S PGs
// ============================================================
// GET /api/pgs/my
// ============================================================

router.get(
  "/my",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      const pgs =
        await PG.find({

          owner:
            req.user.userId,

          isActive:
            true,

        }).sort({

          createdAt:
            -1,

        });


      return res.status(200).json({
        pgs,
      });


    } catch (error) {

      console.error(
        "Get owner PGs error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to load your PGs.",
      });

    }

  }
);


// ============================================================
// GET ROOMS FOR OWNER'S PG
// ============================================================
// GET /api/pgs/:id/rooms
// ============================================================

router.get(
  "/:id/rooms",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      // ------------------------------------------------------
      // VALIDATE OBJECT ID
      // ------------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid PG ID.",
        });

      }


      // ------------------------------------------------------
      // MAKE SURE PG BELONGS TO OWNER
      // ------------------------------------------------------

      const pg =
        await PG.findOne({

          _id:
            req.params.id,

          owner:
            req.user.userId,

          isActive:
            true,

        });


      if (!pg) {

        return res.status(404).json({
          message:
            "PG not found or you do not own this PG.",
        });

      }


      // ------------------------------------------------------
      // LOAD ACTUAL ROOMS
      // ------------------------------------------------------

      const rooms =
        await Room.find({

          pg:
            pg._id,

        }).sort({

          sharingType:
            -1,

          createdAt:
            1,

        });


      return res.status(200).json({

        pgId:
          pg._id,

        rooms,

      });


    } catch (error) {

      console.error(
        "Get PG rooms error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to load PG rooms.",
      });

    }

  }
);


// ============================================================
// ============================================================
// STUDENT PG DISCOVERY / SEARCH + FILTERS + AVAILABILITY
// ============================================================
//
// GET /api/pgs/search
//
// Supported:
//
//   ?search=Test
//   ?name=Test PG
//   ?city=Tirupati
//   ?sharing=4
//   ?minRent=4000
//   ?maxRent=6000
//   ?gender=male
//   ?amenities=WiFi
//   ?available=true
//
// Examples:
//
// /api/pgs/search?sharing=4&available=true
//
// /api/pgs/search?city=Tirupati&sharing=4&maxRent=5500&available=true
//
// IMPORTANT:
//
// Room availability is checked from the actual Room collection.
//
// A PG is considered available when at least one matching room:
//
//   - belongs to that PG
//   - has the requested sharing type
//   - has the requested rent range
//   - is not under maintenance
//   - has at least one available bed
//
// ============================================================

router.get(
  "/search",

  async (req, res) => {

    try {

      // ========================================================
      // READ QUERY PARAMETERS
      // ========================================================

      const search =
        String(
          req.query.search ||
          ""
        ).trim();


      const name =
        String(
          req.query.name ||
          ""
        ).trim();


      const city =
        String(
          req.query.city ||
          ""
        ).trim();


      const gender =
        String(
          req.query.gender ||
          ""
        ).trim()
        .toLowerCase();


      const sharingParam =
        req.query.sharing;


      const minRentParam =
        req.query.minRent;


      const maxRentParam =
        req.query.maxRent;


      const availableParam =
        String(
          req.query.available ||
          ""
        ).trim()
        .toLowerCase();


        // ========================================================
// LOCATION SEARCH PARAMETERS
// ========================================================

const latitudeParam =
  req.query.latitude;

const longitudeParam =
  req.query.longitude;

const radiusParam =
  req.query.radius;


// --------------------------------------------------------
// LOCATION VALUES
// --------------------------------------------------------

const hasLatitude =
  latitudeParam !== undefined;

const hasLongitude =
  longitudeParam !== undefined;

const hasRadius =
  radiusParam !== undefined;


let latitude = null;
let longitude = null;
let radius = 5;


// --------------------------------------------------------
// VALIDATE LOCATION PARAMETERS
// --------------------------------------------------------

if (
  hasLatitude ||
  hasLongitude
) {

  if (
    !hasLatitude ||
    !hasLongitude
  ) {

    return res.status(400).json({
      success: false,

      message:
        "latitude and longitude must be provided together.",
    });

  }


  latitude =
    Number(latitudeParam);

  longitude =
    Number(longitudeParam);


  if (
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90
  ) {

    return res.status(400).json({
      success: false,

      message:
        "latitude must be a valid number between -90 and 90.",
    });

  }


  if (
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180
  ) {

    return res.status(400).json({
      success: false,

      message:
        "longitude must be a valid number between -180 and 180.",
    });

  }


  if (hasRadius) {

    radius =
      Number(radiusParam);


    if (
      !Number.isFinite(radius) ||
      radius <= 0 ||
      radius > 100
    ) {

      return res.status(400).json({
        success: false,

        message:
          "radius must be a number greater than 0 and no more than 100 km.",
      });

    }

  }

}




      // ========================================================
      // VALIDATE AVAILABLE FILTER
      // ========================================================

      if (
        availableParam &&
        availableParam !== "true" &&
        availableParam !== "false"
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "available must be true or false.",

        });

      }


      const onlyAvailable =
        availableParam === "true";


      // ========================================================
      // BUILD BASE PG QUERY
      // ========================================================

      const query = {

        isActive:
          true,

      };


      // ========================================================
      // TEXT SEARCH
      // ========================================================

      if (search) {

        const escapedSearch =
          search.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );


        const searchRegex =
          new RegExp(
            escapedSearch,
            "i"
          );


        query.$or = [

          {
            name:
              searchRegex,
          },

          {
            address:
              searchRegex,
          },

          {
            city:
              searchRegex,
          },

        ];

      }


      // ========================================================
      // NAME FILTER
      // ========================================================

      if (name) {

        const escapedName =
          name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );


        query.name =
          new RegExp(
            escapedName,
            "i"
          );

      }


      // ========================================================
      // CITY FILTER
      // ========================================================

      if (city) {

        const escapedCity =
          city.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );


        query.city =
          new RegExp(
            `^${escapedCity}$`,
            "i"
          );

      }


      // ========================================================
      // GENDER FILTER
      // ========================================================

      if (gender) {

        const allowedGenders = [

          "male",

          "female",

          "co-ed",

        ];


        if (
          !allowedGenders.includes(
            gender
          )
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "Invalid gender filter. Use male, female, or co-ed.",

          });

        }


        query.gender =
          gender;

      }


      // ========================================================
      // VALIDATE RENT / SHARING PARAMETERS
      // ========================================================

      const hasSharing =
        sharingParam !==
        undefined;


      const hasMinRent =
        minRentParam !==
        undefined;


      const hasMaxRent =
        maxRentParam !==
        undefined;


      let sharing =
        null;


      let minRent =
        null;


      let maxRent =
        null;


      if (hasSharing) {

        sharing =
          Number(
            sharingParam
          );


        if (
          !Number.isInteger(
            sharing
          ) ||
          sharing < 1
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "Sharing must be a whole number greater than 0.",

          });

        }

      }


      if (hasMinRent) {

        minRent =
          Number(
            minRentParam
          );


        if (
          !Number.isFinite(
            minRent
          ) ||
          minRent < 0
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "minRent must be a valid non-negative number.",

          });

        }

      }


      if (hasMaxRent) {

        maxRent =
          Number(
            maxRentParam
          );


        if (
          !Number.isFinite(
            maxRent
          ) ||
          maxRent < 0
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "maxRent must be a valid non-negative number.",

          });

        }

      }


      if (
        minRent !== null &&
        maxRent !== null &&
        minRent > maxRent
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "minRent cannot be greater than maxRent.",

        });

      }


      // ========================================================
      // PG ROOM-TYPE FILTER
      // ========================================================
      //
      // This is still useful even when availability=true,
      // because it filters the PG's declared room types.
      //
      // $elemMatch guarantees sharing + rent belong to
      // the SAME room type.
      //
      // ========================================================

      if (
        hasSharing ||
        hasMinRent ||
        hasMaxRent
      ) {

        const roomTypeFilter =
          {};


        if (
          sharing !== null
        ) {

          roomTypeFilter.sharing =
            sharing;

        }


        if (
          minRent !== null ||
          maxRent !== null
        ) {

          roomTypeFilter.rent =
            {};

        }


        if (
          minRent !== null
        ) {

          roomTypeFilter.rent.$gte =
            minRent;

        }


        if (
          maxRent !== null
        ) {

          roomTypeFilter.rent.$lte =
            maxRent;

        }


        query.roomTypes = {

          $elemMatch:
            roomTypeFilter,

        };

      }


      // ========================================================
      // AMENITIES FILTER
      // ========================================================

      if (
        req.query.amenities
      ) {

        let requestedAmenities;


        if (
          Array.isArray(
            req.query.amenities
          )
        ) {

          requestedAmenities =
            req.query.amenities;

        } else {

          requestedAmenities =
            String(
              req.query.amenities
            )
            .split(",");

        }


        requestedAmenities =
          requestedAmenities
            .map(
              amenity =>
                String(
                  amenity
                ).trim()
            )
            .filter(
              Boolean
            );


        if (
          requestedAmenities.length >
          0
        ) {

          query.amenities = {

            $all:
              requestedAmenities,

          };

        }

      }


      // ========================================================
      // LOAD MATCHING PGs
      // ========================================================

      const pgs =
        await PG.find(
          query
        )
        .select(
          [
            "name",
            "description",
            "address",
            "city",
            "amenities",
            "roomTypes",
            "capacity",
            "availableBeds",
            "ownerReliabilityScore",
            "gender",
            "images",
            "isVerified",
            "location",

          ].join(" ")
        )
        .sort({

          ownerReliabilityScore:
            -1,

          createdAt:
            -1,

        });


      // ========================================================
      // BUILD STUDENT-FACING RESULTS
      // ========================================================

      const results = [];


      for (
        const pg of pgs
      ) {


// ------------------------------------------------------
// LOCATION FILTER
// ------------------------------------------------------
//
// If the student supplied coordinates,
// calculate the actual distance from the student
// to this PG.
//
// PGs without valid coordinates are excluded
// from location-based searches.
// ------------------------------------------------------

let distanceKm =
  null;


if (
  latitude !== null &&
  longitude !== null
) {

  const pgLatitude =
    Number(
      pg.location?.latitude
    );

  const pgLongitude =
    Number(
      pg.location?.longitude
    );


  if (
    !Number.isFinite(
      pgLatitude
    ) ||
    !Number.isFinite(
      pgLongitude
    )
  ) {

    continue;

  }


  distanceKm =
    calculateDistanceKm(
      latitude,
      longitude,
      pgLatitude,
      pgLongitude
    );


  if (
    distanceKm >
    radius
  ) {

    continue;

  }

}



        // ------------------------------------------------------
        // FIND ACTUAL AVAILABLE ROOMS
        // ------------------------------------------------------

        const roomQuery = {

          pg:
            pg._id,

          occupiedBeds: {
            $lt:
              999999999,
          },

          status: {
            $ne:
              "maintenance",
          },

        };


        // ------------------------------------------------------
        // SHARING FILTER
        // ------------------------------------------------------

        if (
          sharing !== null
        ) {

          roomQuery.sharingType =
            sharing;

        }


        // ------------------------------------------------------
        // RENT FILTER
        // ------------------------------------------------------

        if (
          minRent !== null ||
          maxRent !== null
        ) {

          roomQuery.rent =
            {};

        }


        if (
          minRent !== null
        ) {

          roomQuery.rent.$gte =
            minRent;

        }


        if (
          maxRent !== null
        ) {

          roomQuery.rent.$lte =
            maxRent;

        }


        const rooms =
          await Room.find(
            roomQuery
          )
          .select(
            [
              "_id",
              "roomNumber",
              "sharingType",
              "rent",
              "capacity",
              "occupiedBeds",
              "status",

            ].join(" ")
          );


        // ------------------------------------------------------
        // ONLY KEEP ROOMS WITH REAL AVAILABLE BEDS
        // ------------------------------------------------------

        const availableRooms =
          rooms.filter(
            room =>
              Number(
                room.occupiedBeds ||
                0
              ) <
              Number(
                room.capacity ||
                0
              )
          );


        // ------------------------------------------------------
        // AVAILABLE BED TOTAL
        // ------------------------------------------------------

        const matchingAvailableBeds =
          availableRooms.reduce(

            (
              total,
              room
            ) => {

              const capacity =
                Number(
                  room.capacity ||
                  0
                );


              const occupied =
                Number(
                  room.occupiedBeds ||
                  0
                );


              return (
                total +
                Math.max(
                  capacity -
                  occupied,
                  0
                )
              );

            },

            0

          );


        // ------------------------------------------------------
        // IF availability=true, SKIP PGs WITH NO ROOM
        // ------------------------------------------------------

        if (
          onlyAvailable &&
          availableRooms.length === 0
        ) {

          continue;

        }


        // ------------------------------------------------------
        // RETURN PG + ACTUAL MATCHING ROOM INFORMATION
        // ------------------------------------------------------

        results.push({

          _id:
            pg._id,

          name:
            pg.name,

          description:
            pg.description,

          address:
            pg.address,

          city:
            pg.city,

          amenities:
            pg.amenities,

          gender:
            pg.gender,

          images:
            pg.images,

          isVerified:
            pg.isVerified,

          location:
            pg.location,

            distanceKm:
  distanceKm === null
    ? null
    : Math.round(
        distanceKm * 100
      ) / 100,

          ownerReliabilityScore:
            pg.ownerReliabilityScore,

          capacity:
            pg.capacity,

          availableBeds:
            pg.availableBeds,

          matchingAvailableBeds:
            matchingAvailableBeds,

          matchingAvailableRooms:
            availableRooms.map(
              room => ({

                _id:
                  room._id,

                roomNumber:
                  room.roomNumber,

                sharingType:
                  room.sharingType,

                rent:
                  room.rent,

                capacity:
                  room.capacity,

                occupiedBeds:
                  room.occupiedBeds,

                availableBeds:
                  Math.max(
                    Number(
                      room.capacity ||
                      0
                    ) -
                    Number(
                      room.occupiedBeds ||
                      0
                    ),
                    0
                  ),

                status:
                  room.status,

              })
            ),

          roomTypes:
            pg.roomTypes,

        });

      }


      // ========================================================
      // RESPONSE
      // ========================================================

      return res.status(200).json({

        success:
          true,

        count:
          results.length,

        filters: {

          search:
            search || null,

          name:
            name || null,

          city:
            city || null,

          sharing:
            sharing,

          minRent:
            minRent,

          maxRent:
            maxRent,

          gender:
            gender || null,

          amenities:
            req.query.amenities ||
            null,

          available:
            onlyAvailable,

        },

        latitude:
  latitude,

longitude:
  longitude,

radius:
  latitude !== null &&
  longitude !== null
    ? radius
    : null,


        pgs:
          results,

      });


    } catch (error) {

      console.error(
        "Student PG search error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        message:
          "Unable to search PGs.",

      });

    }

  }
);




// ============================================================
// STUDENT MAP-AREA SEARCH
// ============================================================
// GET /api/pgs/search/map
//
// Searches PGs inside the visible map boundaries.
//
// Required:
//   north
//   south
//   east
//   west
//
// Optional:
//   search
//   name
//   city
//   sharing
//   minRent
//   maxRent
//   gender
//   amenities
//   available
//
// Example:
//
// /api/pgs/search/map
//   ?north=13.65
//   &south=13.60
//   &east=79.32
//   &west=79.27
//
// ============================================================

router.get(
  "/search/map",

  async (req, res) => {

    try {

      // ========================================================
      // READ MAP BOUNDARIES
      // ========================================================

      const north =
        Number(req.query.north);

      const south =
        Number(req.query.south);

      const east =
        Number(req.query.east);

      const west =
        Number(req.query.west);


      // ========================================================
      // VALIDATE MAP BOUNDARIES
      // ========================================================

      if (
        !Number.isFinite(north) ||
        !Number.isFinite(south) ||
        !Number.isFinite(east) ||
        !Number.isFinite(west)
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "north, south, east, and west must all be valid numbers.",

        });

      }


      if (
        north < -90 ||
        north > 90 ||
        south < -90 ||
        south > 90
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "north and south must be between -90 and 90.",

        });

      }


      if (
        east < -180 ||
        east > 180 ||
        west < -180 ||
        west > 180
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "east and west must be between -180 and 180.",

        });

      }


      if (
        south > north
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "south cannot be greater than north.",

        });

      }


      // ========================================================
      // READ NORMAL SEARCH FILTERS
      // ========================================================

      const search =
        String(
          req.query.search ||
          ""
        ).trim();


      const name =
        String(
          req.query.name ||
          ""
        ).trim();


      const city =
        String(
          req.query.city ||
          ""
        ).trim();


      const gender =
        String(
          req.query.gender ||
          ""
        ).trim()
        .toLowerCase();


      const sharingParam =
        req.query.sharing;


      const minRentParam =
        req.query.minRent;


      const maxRentParam =
        req.query.maxRent;


      const availableParam =
        String(
          req.query.available ||
          ""
        ).trim()
        .toLowerCase();


      // ========================================================
      // AVAILABLE FILTER
      // ========================================================

      if (
        availableParam &&
        availableParam !== "true" &&
        availableParam !== "false"
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "available must be true or false.",

        });

      }


      const onlyAvailable =
        availableParam === "true";


      // ========================================================
      // VALIDATE SHARING / RENT
      // ========================================================

      const hasSharing =
        sharingParam !==
        undefined;


      const hasMinRent =
        minRentParam !==
        undefined;


      const hasMaxRent =
        maxRentParam !==
        undefined;


      let sharing =
        null;


      let minRent =
        null;


      let maxRent =
        null;


      // --------------------------------------------------------
      // SHARING
      // --------------------------------------------------------

      if (
        hasSharing
      ) {

        sharing =
          Number(
            sharingParam
          );


        if (
          !Number.isInteger(
            sharing
          ) ||
          sharing < 1
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "Sharing must be a whole number greater than 0.",

          });

        }

      }


      // --------------------------------------------------------
      // MIN RENT
      // --------------------------------------------------------

      if (
        hasMinRent
      ) {

        minRent =
          Number(
            minRentParam
          );


        if (
          !Number.isFinite(
            minRent
          ) ||
          minRent < 0
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "minRent must be a valid non-negative number.",

          });

        }

      }


      // --------------------------------------------------------
      // MAX RENT
      // --------------------------------------------------------

      if (
        hasMaxRent
      ) {

        maxRent =
          Number(
            maxRentParam
          );


        if (
          !Number.isFinite(
            maxRent
          ) ||
          maxRent < 0
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "maxRent must be a valid non-negative number.",

          });

        }

      }


      if (
        minRent !== null &&
        maxRent !== null &&
        minRent > maxRent
      ) {

        return res.status(400).json({

          success:
            false,

          message:
            "minRent cannot be greater than maxRent.",

        });

      }


      // ========================================================
      // BUILD PG QUERY
      // ========================================================

      const query = {

        isActive:
          true,

        "location.latitude": {
          $gte:
            south,

          $lte:
            north,

        },

      };


      // ========================================================
      // LONGITUDE FILTER
      // ========================================================

      /*
        Normal map searches do not cross
        the international date line.

        If west <= east:

          longitude >= west
          longitude <= east
      */

      if (
        west <= east
      ) {

        query[
          "location.longitude"
        ] = {

          $gte:
            west,

          $lte:
            east,

        };

      } else {

        /*
          Dateline-crossing map.

          Example:

          west = 179
          east = -179

          Valid longitude is:

          >= 179 OR <= -179
        */

        query[
          "location.longitude"
        ] = {

          $in: [

            {
              $gte:
                west,

            },

            {
              $lte:
                east,

            },

          ],

        };

      }


      // ========================================================
      // TEXT SEARCH
      // ========================================================

      if (
        search
      ) {

        const escapedSearch =
          search.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );


        const searchRegex =
          new RegExp(
            escapedSearch,
            "i"
          );


        query.$or = [

          {
            name:
              searchRegex,
          },

          {
            address:
              searchRegex,
          },

          {
            city:
              searchRegex,
          },

        ];

      }


      // ========================================================
      // NAME FILTER
      // ========================================================

      if (
        name
      ) {

        const escapedName =
          name.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );


        query.name =
          new RegExp(
            escapedName,
            "i"
          );

      }


      // ========================================================
      // CITY FILTER
      // ========================================================

      if (
        city
      ) {

        const escapedCity =
          city.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          );


        query.city =
          new RegExp(
            `^${escapedCity}$`,
            "i"
          );

      }


      // ========================================================
      // GENDER FILTER
      // ========================================================

      if (
        gender
      ) {

        const allowedGenders = [

          "male",

          "female",

          "co-ed",

        ];


        if (
          !allowedGenders.includes(
            gender
          )
        ) {

          return res.status(400).json({

            success:
              false,

            message:
              "Invalid gender filter. Use male, female, or co-ed.",

          });

        }


        query.gender =
          gender;

      }


      // ========================================================
      // ROOM-TYPE FILTER
      // ========================================================

      if (
        hasSharing ||
        hasMinRent ||
        hasMaxRent
      ) {

        const roomTypeFilter =
          {};


        if (
          sharing !== null
        ) {

          roomTypeFilter.sharing =
            sharing;

        }


        if (
          minRent !== null ||
          maxRent !== null
        ) {

          roomTypeFilter.rent =
            {};

        }


        if (
          minRent !== null
        ) {

          roomTypeFilter.rent.$gte =
            minRent;

        }


        if (
          maxRent !== null
        ) {

          roomTypeFilter.rent.$lte =
            maxRent;

        }


        query.roomTypes = {

          $elemMatch:
            roomTypeFilter,

        };

      }


      // ========================================================
      // AMENITIES FILTER
      // ========================================================

      if (
        req.query.amenities
      ) {

        let requestedAmenities;


        if (
          Array.isArray(
            req.query.amenities
          )
        ) {

          requestedAmenities =
            req.query.amenities;

        } else {

          requestedAmenities =
            String(
              req.query.amenities
            )
            .split(",");

        }


        requestedAmenities =
          requestedAmenities
            .map(
              amenity =>
                String(
                  amenity
                ).trim()
            )
            .filter(
              Boolean
            );


        if (
          requestedAmenities.length >
          0
        ) {

          query.amenities = {

            $all:
              requestedAmenities,

          };

        }

      }


      // ========================================================
      // LOAD PGs INSIDE MAP
      // ========================================================

      const pgs =
        await PG.find(
          query
        )
        .select(
          [
            "name",
            "description",
            "address",
            "city",
            "amenities",
            "roomTypes",
            "capacity",
            "availableBeds",
            "ownerReliabilityScore",
            "gender",
            "images",
            "isVerified",
            "location",

          ].join(" ")
        )
        .sort({

          ownerReliabilityScore:
            -1,

          createdAt:
            -1,

        });


      // ========================================================
      // BUILD RESULTS
      // ========================================================

      const results = [];


      for (
        const pg of pgs
      ) {

        // ------------------------------------------------------
        // FIND ACTUAL AVAILABLE ROOMS
        // ------------------------------------------------------

        const roomQuery = {

          pg:
            pg._id,

          status: {
            $ne:
              "maintenance",
          },

        };


        // ------------------------------------------------------
        // SHARING FILTER
        // ------------------------------------------------------

        if (
          sharing !== null
        ) {

          roomQuery.sharingType =
            sharing;

        }


        // ------------------------------------------------------
        // RENT FILTER
        // ------------------------------------------------------

        if (
          minRent !== null ||
          maxRent !== null
        ) {

          roomQuery.rent =
            {};

        }


        if (
          minRent !== null
        ) {

          roomQuery.rent.$gte =
            minRent;

        }


        if (
          maxRent !== null
        ) {

          roomQuery.rent.$lte =
            maxRent;

        }


        // ------------------------------------------------------
        // LOAD ROOMS
        // ------------------------------------------------------

        const rooms =
          await Room.find(
            roomQuery
          )
          .select(
            [
              "_id",
              "roomNumber",
              "sharingType",
              "rent",
              "capacity",
              "occupiedBeds",
              "status",

            ].join(" ")
          );


        // ------------------------------------------------------
        // ONLY ROOMS WITH AVAILABLE BEDS
        // ------------------------------------------------------

        const availableRooms =
          rooms.filter(
            room =>
              Number(
                room.occupiedBeds ||
                0
              ) <
              Number(
                room.capacity ||
                0
              )
          );


        // ------------------------------------------------------
        // AVAILABLE BED TOTAL
        // ------------------------------------------------------

        const matchingAvailableBeds =
          availableRooms.reduce(

            (
              total,
              room
            ) => {

              const capacity =
                Number(
                  room.capacity ||
                  0
                );


              const occupied =
                Number(
                  room.occupiedBeds ||
                  0
                );


              return (
                total +
                Math.max(
                  capacity -
                  occupied,
                  0
                )
              );

            },

            0

          );


        // ------------------------------------------------------
        // AVAILABLE FILTER
        // ------------------------------------------------------

        if (
          onlyAvailable &&
          availableRooms.length === 0
        ) {

          continue;

        }


        // ------------------------------------------------------
        // STUDENT-FACING RESULT
        // ------------------------------------------------------

        results.push({

          _id:
            pg._id,

          name:
            pg.name,

          description:
            pg.description,

          address:
            pg.address,

          city:
            pg.city,

          amenities:
            pg.amenities,

          gender:
            pg.gender,

          images:
            pg.images,

          isVerified:
            pg.isVerified,

          location:
            pg.location,

          ownerReliabilityScore:
            pg.ownerReliabilityScore,

          capacity:
            pg.capacity,

          availableBeds:
            pg.availableBeds,

          matchingAvailableBeds:
            matchingAvailableBeds,

          matchingAvailableRooms:
            availableRooms.map(
              room => ({

                _id:
                  room._id,

                roomNumber:
                  room.roomNumber,

                sharingType:
                  room.sharingType,

                rent:
                  room.rent,

                capacity:
                  room.capacity,

                occupiedBeds:
                  room.occupiedBeds,

                availableBeds:
                  Math.max(
                    Number(
                      room.capacity ||
                      0
                    ) -
                    Number(
                      room.occupiedBeds ||
                      0
                    ),
                    0
                  ),

                status:
                  room.status,

              })
            ),

          roomTypes:
            pg.roomTypes,

        });

      }


      // ========================================================
      // RESPONSE
      // ========================================================

      return res.status(200).json({

        success:
          true,

        count:
          results.length,

        filters: {

          search:
            search || null,

          name:
            name || null,

          city:
            city || null,

          sharing:
            sharing,

          minRent:
            minRent,

          maxRent:
            maxRent,

          gender:
            gender || null,

          amenities:
            req.query.amenities ||
            null,

          available:
            onlyAvailable,

        },

        mapBounds: {

          north,

          south,

          east,

          west,

        },

        pgs:
          results,

      });


    } catch (error) {

      console.error(
        "Student map PG search error:",
        error
      );


      return res.status(500).json({

        success:
          false,

        message:
          "Unable to search PGs on map.",

      });

    }

  }
);


// ============================================================
// GET ONE PG
// ============================================================
// GET /api/pgs/:id
// ============================================================

router.get(
  "/:id",
  authenticateToken,

  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid PG ID.",
        });

      }


      const pg =
        await PG.findOne({

          _id:
            req.params.id,

          isActive:
            true,

        });


      if (!pg) {

        return res.status(404).json({
          message:
            "PG not found.",
        });

      }


      return res.status(200).json({
        pg,
      });


    } catch (error) {

      console.error(
        "Get PG error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to load PG.",
      });

    }

  }
);


// ============================================================
// UPDATE PG
// ============================================================
// PUT /api/pgs/:id
// ============================================================

router.put(
  "/:id",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      // ------------------------------------------------------
      // VALIDATE OBJECT ID
      // ------------------------------------------------------

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid PG ID.",
        });

      }


      // ------------------------------------------------------
      // FIND OWNER'S PG
      // ------------------------------------------------------

      const pg =
        await PG.findOne({

          _id:
            req.params.id,

          owner:
            req.user.userId,

          isActive:
            true,

        });


      if (!pg) {

        return res.status(404).json({
          message:
            "PG not found or you do not own this PG.",
        });

      }


      // ------------------------------------------------------
      // NORMAL PG FIELDS
      // ------------------------------------------------------

      const allowedFields = [

        "name",

        "description",

        "address",

        "city",

        "amenities",

        "gender",

        "phone",

        "images",

        "location",

      ];


      for (
        const field of
        allowedFields
      ) {

        if (
          req.body[field] !==
          undefined
        ) {

          pg[field] =
            req.body[field];

        }

      }


      // ======================================================
      // ROOM TYPES
      // ======================================================

      /*
        We update the PG's room-type
        configuration and totals.

        IMPORTANT:

        Each room type contains:

          sharing
          roomCount
          rent
          namingStyle
          prefix
          startNumber

        We deliberately do NOT regenerate
        Room documents here.

        Existing rooms may already have
        residents/bookings later.

        Dedicated room management will
        handle actual room changes.
      */

      if (
        req.body.roomTypes !==
        undefined
      ) {

        // ----------------------------------------------------
        // VALIDATE ROOM TYPES
        // ----------------------------------------------------

        const roomValidation =
          validateRoomTypes(
            req.body.roomTypes
          );


        if (
          !roomValidation.valid
        ) {

          return res.status(400).json({
            message:
              roomValidation.message,
          });

        }


        // ----------------------------------------------------
        // VALIDATE GENERATED NAMES
        // ----------------------------------------------------

        const nameValidation =
          validateGeneratedRoomNames(
            req.body.roomTypes
          );


        if (
          !nameValidation.valid
        ) {

          return res.status(400).json({
            message:
              nameValidation.message,
          });

        }


        // ----------------------------------------------------
        // CALCULATE NEW TOTALS
        // ----------------------------------------------------

        const {
          totalRooms,
          capacity,
        } =
          calculateRoomTotals(
            req.body.roomTypes
          );


        // ----------------------------------------------------
        // NORMALIZE ROOM TYPES
        // ----------------------------------------------------

        pg.roomTypes =
          req.body.roomTypes.map(
            (roomType) => {

              const namingStyle =
                roomType.namingStyle ||
                "number";


              return {

                sharing:
                  Number(
                    roomType.sharing
                  ),


                roomCount:
                  Number(
                    roomType.roomCount
                  ),


                rent:
                  Number(
                    roomType.rent
                  ),


                namingStyle,


                prefix:
                  namingStyle ===
                  "prefix-number"

                    ? String(
                        roomType.prefix ||
                        ""
                      ).trim()

                    : "",


                startNumber:
                  namingStyle ===
                  "later"

                    ? null

                    : Number(
                        roomType.startNumber
                      ),

              };

            }
          );


        pg.totalRooms =
          totalRooms;


        pg.capacity =
          capacity;


        // ----------------------------------------------------
        // PREVENT AVAILABLE BEDS FROM EXCEEDING CAPACITY
        // ----------------------------------------------------

        if (
          pg.availableBeds >
          capacity
        ) {

          pg.availableBeds =
            capacity;

        }

      }


      // ------------------------------------------------------
      // SAVE
      // ------------------------------------------------------

      await pg.save();


      return res.status(200).json({

        message:
          "PG updated successfully.",

        pg,

      });


    } catch (error) {

      console.error(
        "Update PG error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to update PG.",
      });

    }

  }
);


// ============================================================
// DELETE PG
// ============================================================

router.delete(
  "/:id",
  authenticateToken,
  requireOwner,

  async (req, res) => {

    try {

      if (
        !mongoose.Types.ObjectId.isValid(
          req.params.id
        )
      ) {

        return res.status(400).json({
          message:
            "Invalid PG ID.",
        });

      }


      const pg =
        await PG.findOne({

          _id:
            req.params.id,

          owner:
            req.user.userId,

          isActive:
            true,

        });


      if (!pg) {

        return res.status(404).json({
          message:
            "PG not found or you do not own this PG.",
        });

      }


      pg.isActive =
        false;


      await pg.save();


      return res.status(200).json({
        message:
          "PG removed successfully.",
      });


    } catch (error) {

      console.error(
        "Delete PG error:",
        error
      );


      return res.status(500).json({
        message:
          "Unable to remove PG.",
      });

    }

  }
);


// ============================================================
// EXPORT
// ============================================================

module.exports =
  router;