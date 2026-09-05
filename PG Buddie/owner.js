const API_BASE_URL = "http://localhost:5000";

let ownerPGs = [];
let selectedPG = null;


// ==========================================
// AUTH
// ==========================================

function getToken() {
  return localStorage.getItem("pgBuddieToken");
}


function requireToken() {
  const token = getToken();

  if (!token) {
    window.location.href = "login.html";
    return null;
  }

  return token;
}


// ==========================================
// DOM ELEMENTS
// ==========================================

const ownerNameText =
  document.getElementById("ownerNameText");

const pgSelector =
  document.getElementById("pgSelector");

const selectedPGName =
  document.getElementById("selectedPGName");

const selectedPGDetails =
  document.getElementById("selectedPGDetails");

const addPgBtn =
  document.getElementById("addPgBtn");

const pgModal =
  document.getElementById("pgModal");

const closePgModal =
  document.getElementById("closePgModal");

const cancelPgBtn =
  document.getElementById("cancelPgBtn");

const pgForm =
  document.getElementById("pgForm");

const pgFormMessage =
  document.getElementById("pgFormMessage");


// Dashboard

const studentCount =
  document.getElementById("studentCount");

const capacityCount =
  document.getElementById("capacityCount");

const availableBedsCount =
  document.getElementById("availableBedsCount");

const occupancyCount =
  document.getElementById("occupancyCount");


// Location

const useCurrentLocationBtn =
  document.getElementById(
    "useCurrentLocationBtn"
  );

const pickLocationBtn =
  document.getElementById(
    "pickLocationBtn"
  );

const clearLocationBtn =
  document.getElementById(
    "clearLocationBtn"
  );

const locationStatus =
  document.getElementById(
    "locationStatus"
  );

const pgLatitude =
  document.getElementById(
    "pgLatitude"
  );

const pgLongitude =
  document.getElementById(
    "pgLongitude"
  );


// Map modal

const locationMapModal =
  document.getElementById(
    "locationMapModal"
  );

const closeLocationMapBtn =
  document.getElementById(
    "closeLocationMapBtn"
  );

const cancelMapLocationBtn =
  document.getElementById(
    "cancelMapLocationBtn"
  );

const confirmMapLocationBtn =
  document.getElementById(
    "confirmMapLocationBtn"
  );

const pgLocationMap =
  document.getElementById(
    "pgLocationMap"
  );

const mapLocationStatus =
  document.getElementById(
    "mapLocationStatus"
  );


// Map state

let locationMap = null;

let locationMarker = null;

let pendingMapLocation = null;


// ==========================================
// OWNER INFORMATION
// ==========================================

function loadOwnerInformation() {

  const storedUser =
    localStorage.getItem(
      "pgBuddieUser"
    );

  if (!storedUser) {
    return;
  }

  try {

    const user =
      JSON.parse(storedUser);

    if (user.name) {

      ownerNameText.textContent =
        user.name;

    }

  } catch (error) {

    console.error(
      "Unable to read owner information:",
      error
    );

  }
}


// ==========================================
// LOAD OWNER PGs
// ==========================================

async function loadOwnerPGs() {

  const token =
    requireToken();

  if (!token) {
    return;
  }

  try {

    pgSelector.innerHTML =
      `<option value="">
        Loading your PGs...
      </option>`;


    const response =
      await fetch(
        `${API_BASE_URL}/api/pgs/my`,
        {
          method: "GET",

          headers: {
            Authorization:
              `Bearer ${token}`
          }
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      console.error(
        "Unable to load PGs:",
        data
      );

      pgSelector.innerHTML =
        `<option value="">
          Unable to load PGs
        </option>`;

      return;
    }


    ownerPGs =
      data.pgs || [];


    // --------------------------------------
    // NO PGs
    // --------------------------------------

    if (ownerPGs.length === 0) {

      pgSelector.innerHTML =
        `<option value="">
          No PGs added yet
        </option>`;

      selectedPG = null;

      showNoPGState();

      return;
    }


    // --------------------------------------
    // POPULATE SELECTOR
    // --------------------------------------

    pgSelector.innerHTML =
      `<option value="">
        Select a PG
      </option>`;


    ownerPGs.forEach(
      (pg) => {

        const option =
          document.createElement(
            "option"
          );

        option.value =
          pg._id;

        option.textContent =
          pg.name;

        pgSelector.appendChild(
          option
        );

      }
    );


    // --------------------------------------
    // SELECT FIRST PG
    // --------------------------------------

    pgSelector.value =
      ownerPGs[0]._id;

    selectPG(
      ownerPGs[0]._id
    );


  } catch (error) {

    console.error(
      "Load PGs error:",
      error
    );

    pgSelector.innerHTML =
      `<option value="">
        Unable to connect to server
      </option>`;

  }
}


// ==========================================
// SELECT PG
// ==========================================

function selectPG(pgId) {

  selectedPG =
    ownerPGs.find(
      (pg) =>
        pg._id === pgId
    );


  if (!selectedPG) {

    showNoPGState();

    return;
  }


  selectedPGName.textContent =
    selectedPG.name;


  const locationText =
    selectedPG.city
      ? `📍 ${selectedPG.city}`
      : `📍 ${selectedPG.address}`;


  const verificationText =
    selectedPG.isVerified
      ? "✓ Verified"
      : "⏳ Verification pending";


  selectedPGDetails.textContent =
    `${locationText} • ${verificationText}`;


  updateDashboardForPG(
    selectedPG
  );
}


// ==========================================
// EMPTY PG STATE
// ==========================================

function showNoPGState() {

  selectedPGName.textContent =
    "No PG selected";


  selectedPGDetails.textContent =
    "Add a PG to start managing your property.";


  studentCount.textContent =
    "0";

  capacityCount.textContent =
    "0";

  availableBedsCount.textContent =
    "0";

  occupancyCount.textContent =
    "0%";
}


// ==========================================
// DASHBOARD STATISTICS
// ==========================================

function updateDashboardForPG(pg) {

  const capacity =
    Number(pg.capacity) || 0;


  const availableBeds =
    Number(pg.availableBeds) || 0;


  const occupiedBeds =
    Math.max(
      capacity - availableBeds,
      0
    );


  studentCount.textContent =
    occupiedBeds;


  capacityCount.textContent =
    capacity;


  availableBedsCount.textContent =
    availableBeds;


  const occupancy =
    capacity > 0
      ? Math.round(
          (occupiedBeds / capacity) * 100
        )
      : 0;


  occupancyCount.textContent =
    `${occupancy}%`;
}


// ==========================================
// PG SELECTOR
// ==========================================

pgSelector.addEventListener(
  "change",
  () => {

    const pgId =
      pgSelector.value;


    if (!pgId) {

      selectedPG = null;

      showNoPGState();

      return;
    }


    selectPG(pgId);

  }
);


// ==========================================
// LOCATION STATUS
// ==========================================

function setLocationStatus(
  message,
  success = false
) {

  if (!locationStatus) {
    return;
  }


  locationStatus.textContent =
    message;


  locationStatus.style.color =
    success
      ? "#198754"
      : "#666";
}


// ==========================================
// USE CURRENT LOCATION
// ==========================================

if (useCurrentLocationBtn) {

  useCurrentLocationBtn.addEventListener(
    "click",
    () => {

      if (
        !navigator.geolocation
      ) {

        setLocationStatus(
          "Location is not supported by this browser."
        );

        return;
      }


      setLocationStatus(
        "Getting your location..."
      );


      useCurrentLocationBtn.disabled =
        true;


      navigator.geolocation.getCurrentPosition(

        (position) => {

          const latitude =
            position.coords.latitude;

          const longitude =
            position.coords.longitude;


          pgLatitude.value =
            latitude;

          pgLongitude.value =
            longitude;


          setLocationStatus(
            "✓ PG location selected successfully.",
            true
          );


          useCurrentLocationBtn.disabled =
            false;

        },


        (error) => {

          useCurrentLocationBtn.disabled =
            false;


          let message =
            "Unable to get your location.";


          if (
            error.code === 1
          ) {

            message =
              "Location permission was denied. You can still create the PG without a location.";

          } else if (
            error.code === 2
          ) {

            message =
              "Your location could not be determined. Please try again.";

          } else if (
            error.code === 3
          ) {

            message =
              "Location request timed out. Please try again.";

          }


          setLocationStatus(
            message
          );

        },


        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }

      );

    }
  );

}


// ==========================================
// MAP PICKER
// ==========================================

function closeLocationMap() {

  if (!locationMapModal) {
    return;
  }


  locationMapModal.classList.remove(
    "show"
  );


  locationMapModal.setAttribute(
    "aria-hidden",
    "true"
  );
}


function updateMapStatus() {

  if (!pendingMapLocation) {
    return;
  }


  if (mapLocationStatus) {

    mapLocationStatus.textContent =
      "✓ Location selected. Drag the pin to fine-tune it.";

    mapLocationStatus.style.color =
      "#198754";

  }


  if (confirmMapLocationBtn) {

    confirmMapLocationBtn.disabled =
      false;

  }
}


function setMapLocation(
  latitude,
  longitude
) {

  pendingMapLocation = {

    latitude:
      latitude,

    longitude:
      longitude

  };


  if (locationMarker) {

    locationMarker.setLatLng(
      [
        latitude,
        longitude
      ]
    );

  } else {

    locationMarker =
      L.marker(
        [
          latitude,
          longitude
        ],
        {
          draggable: true
        }
      ).addTo(
        locationMap
      );


    locationMarker.on(
      "dragend",
      () => {

        const position =
          locationMarker.getLatLng();


        pendingMapLocation = {

          latitude:
            position.lat,

          longitude:
            position.lng

        };


        updateMapStatus();

      }
    );

  }


  locationMap.setView(
    [
      latitude,
      longitude
    ],
    Math.max(
      locationMap.getZoom(),
      16
    )
  );


  updateMapStatus();
}


function openLocationMap() {

  if (!window.L) {

    setLocationStatus(
      "Map could not be loaded. Please check your internet connection."
    );

    return;
  }


  locationMapModal.classList.add(
    "show"
  );


  locationMapModal.setAttribute(
    "aria-hidden",
    "false"
  );


  const existingLatitude =
    Number(
      pgLatitude.value
    );


  const existingLongitude =
    Number(
      pgLongitude.value
    );


  let startLatitude =
    20.5937;

  let startLongitude =
    78.9629;

  let startZoom =
    5;


  // If location already exists,
  // open map at that location.

  if (
    Number.isFinite(
      existingLatitude
    ) &&
    Number.isFinite(
      existingLongitude
    )
  ) {

    startLatitude =
      existingLatitude;

    startLongitude =
      existingLongitude;

    startZoom =
      16;

  }


  // Create map only once.

  if (!locationMap) {

    locationMap =
      L.map(
        "pgLocationMap"
      ).setView(
        [
          startLatitude,
          startLongitude
        ],
        startZoom
      );


    L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,

        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
      }
    ).addTo(
      locationMap
    );


    // Click map = place pin

    locationMap.on(
      "click",
      (event) => {

        setMapLocation(
          event.latlng.lat,
          event.latlng.lng
        );

      }
    );

  } else {

    locationMap.setView(
      [
        startLatitude,
        startLongitude
      ],
      startZoom
    );

  }


  setTimeout(
    () => {

      locationMap.invalidateSize();

    },
    150
  );


  // Show existing location if present.

  if (
    Number.isFinite(
      existingLatitude
    ) &&
    Number.isFinite(
      existingLongitude
    )
  ) {

    setMapLocation(
      existingLatitude,
      existingLongitude
    );

  } else {

    pendingMapLocation =
      null;


    if (confirmMapLocationBtn) {

      confirmMapLocationBtn.disabled =
        true;

    }


    if (mapLocationStatus) {

      mapLocationStatus.textContent =
        "Click the map to choose the PG location.";

      mapLocationStatus.style.color =
        "#666";

    }

  }
}


// Open map

if (pickLocationBtn) {

  pickLocationBtn.addEventListener(
    "click",
    openLocationMap
  );

}


// Close map

if (closeLocationMapBtn) {

  closeLocationMapBtn.addEventListener(
    "click",
    closeLocationMap
  );

}


if (cancelMapLocationBtn) {

  cancelMapLocationBtn.addEventListener(
    "click",
    closeLocationMap
  );

}


// Click outside map modal

if (locationMapModal) {

  locationMapModal.addEventListener(
    "click",
    (event) => {

      if (
        event.target ===
        locationMapModal
      ) {

        closeLocationMap();

      }

    }
  );

}


// Confirm selected map location

if (confirmMapLocationBtn) {

  confirmMapLocationBtn.addEventListener(
    "click",
    () => {

      if (!pendingMapLocation) {
        return;
      }


      pgLatitude.value =
        pendingMapLocation.latitude;


      pgLongitude.value =
        pendingMapLocation.longitude;


      setLocationStatus(
        "✓ PG location selected from the map.",
        true
      );


      closeLocationMap();

    }
  );

}


// Clear location

if (clearLocationBtn) {

  clearLocationBtn.addEventListener(
    "click",
    () => {

      pgLatitude.value =
        "";

      pgLongitude.value =
        "";


      pendingMapLocation =
        null;


      if (
        locationMarker &&
        locationMap
      ) {

        locationMap.removeLayer(
          locationMarker
        );


        locationMarker =
          null;

      }


      setLocationStatus(
        "Location cleared. It is optional."
      );

    }
  );

}


// ==========================================
// OPEN ADD PG MODAL
// ==========================================

addPgBtn.addEventListener(
  "click",
  () => {

    pgForm.reset();


    // Reset room types

    if (
      typeof window.resetRoomTypes ===
      "function"
    ) {

      window.resetRoomTypes();

    }


    // Reset location

    if (pgLatitude) {

      pgLatitude.value =
        "";

    }


    if (pgLongitude) {

      pgLongitude.value =
        "";

    }


    pendingMapLocation =
      null;


    if (
      locationMarker &&
      locationMap
    ) {

      locationMap.removeLayer(
        locationMarker
      );


      locationMarker =
        null;

    }


    setLocationStatus(
      "Location is optional. You can add it now or later."
    );


    pgFormMessage.textContent =
      "";

    pgFormMessage.style.color =
      "";


    pgModal.classList.add(
      "show"
    );


    pgModal.setAttribute(
      "aria-hidden",
      "false"
    );

  }
);


// ==========================================
// CLOSE PG MODAL
// ==========================================

function closeModal() {

  pgModal.classList.remove(
    "show"
  );


  pgModal.setAttribute(
    "aria-hidden",
    "true"
  );

}


closePgModal.addEventListener(
  "click",
  closeModal
);


cancelPgBtn.addEventListener(
  "click",
  closeModal
);


pgModal.addEventListener(
  "click",
  (event) => {

    if (
      event.target ===
      pgModal
    ) {

      closeModal();

    }

  }
);


// ==========================================
// ROOM NAMING VALIDATION
// ==========================================

function validateRoomNaming(roomTypes) {

  const generatedNames =
    new Set();


  for (
    const room of roomTypes
  ) {

    const sharing =
      Number(
        room.sharing
      );


    const roomCount =
      Number(
        room.roomCount
      );


    const namingStyle =
      room.namingStyle ||
      "number";


    if (
      !Number.isInteger(
        sharing
      ) ||
      sharing < 1 ||
      !Number.isInteger(
        roomCount
      ) ||
      roomCount < 1
    ) {

      return {
        valid: false,

        message:
          "Please enter valid room-sharing details."
      };

    }


    /*
      Every room type must now have
      its own monthly rent.
    */

    const roomRent =
      Number(
        room.rent
      );


    if (
      !Number.isFinite(
        roomRent
      ) ||
      roomRent < 0
    ) {

      return {
        valid: false,

        message:
          "Please enter a valid monthly rent for every room type."
      };

    }


    /*
      "Name later"

      The owner does not need to provide
      a prefix or starting number.

      The backend will generate temporary
      room names.
    */

    if (
      namingStyle ===
      "later"
    ) {

      continue;

    }


    const startNumber =
      Number(
        room.startNumber
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
          "Please enter a valid starting room number for every room type."
      };

    }


    const prefix =
      namingStyle ===
      "prefix-number"

        ? String(
            room.prefix ||
            ""
          ).trim()

        : "";


    if (
      namingStyle ===
        "prefix-number" &&
      !prefix
    ) {

      return {
        valid: false,

        message:
          "Please enter a prefix for every room type."
      };

    }


    /*
      Calculate generated room names.

      The owner enters:

        roomCount
        startNumber

      PG-Buddie calculates:

        end =
          startNumber +
          roomCount -
          1
    */

    for (
      let index = 0;
      index < roomCount;
      index++
    ) {

      const roomName =
        `${prefix}${startNumber + index}`;


      const normalizedName =
        roomName
          .trim()
          .toLowerCase();


      if (
        generatedNames.has(
          normalizedName
        )
      ) {

        return {
          valid: false,

          message:
            `Duplicate room name "${roomName}". Please use a different room range or prefix.`
        };

      }


      generatedNames.add(
        normalizedName
      );

    }

  }


  return {
    valid: true
  };

}


// ==========================================
// NORMALIZE ROOM TYPES
// ==========================================

function normalizeRoomTypes(
  roomTypes
) {

  return roomTypes.map(
    (room) => {

      const namingStyle =
        room.namingStyle ||
        "number";


      return {

        sharing:
          Number(
            room.sharing
          ),


        roomCount:
          Number(
            room.roomCount
          ),


        /*
          MONTHLY RENT PER ROOM TYPE

          Example:

          5-share → ₹6000
          4-share → ₹7000
        */

        rent:
          Number(
            room.rent
          ),


        namingStyle,


        /*
          Starting number is only relevant
          for generated numeric names.
        */

        startNumber:
          namingStyle ===
            "later"

            ? null

            : Number(
                room.startNumber
              ),


        /*
          Prefix is only relevant for
          Prefix + numbers.
        */

        prefix:
          namingStyle ===
            "prefix-number"

            ? String(
                room.prefix ||
                ""
              ).trim()

            : ""

      };

    }
  );

}


// ==========================================
// CREATE PG
// ==========================================

pgForm.addEventListener(
  "submit",
  async (event) => {

    event.preventDefault();


    const token =
      requireToken();


    if (!token) {
      return;
    }


    // --------------------------------------
    // GET ROOM TYPES
    // --------------------------------------

    const roomTypes =
      typeof window.getRoomTypes ===
      "function"

        ? window.getRoomTypes()

        : [];


    if (
      roomTypes.length === 0
    ) {

      pgFormMessage.textContent =
        "Please add at least one room-sharing type.";


      pgFormMessage.style.color =
        "#d9534f";


      return;

    }


    // --------------------------------------
    // VALIDATE ROOM NAMING + RENT
    // --------------------------------------

    const namingValidation =
      validateRoomNaming(
        roomTypes
      );


    if (
      !namingValidation.valid
    ) {

      pgFormMessage.textContent =
        namingValidation.message;


      pgFormMessage.style.color =
        "#d9534f";


      return;

    }


    /*
      Normalize the room data before
      sending it to the backend.

      The backend will use:

        sharing
        roomCount
        rent
        namingStyle
        prefix
        startNumber

      to create the actual Room documents.
    */

    const normalizedRoomTypes =
      normalizeRoomTypes(
        roomTypes
      );


    // --------------------------------------
    // CALCULATE TOTAL ROOMS
    // --------------------------------------

    const totalRooms =
      normalizedRoomTypes.reduce(
        (sum, room) =>
          sum +
          room.roomCount,

        0
      );


    // --------------------------------------
    // CALCULATE CAPACITY
    // --------------------------------------

    const capacity =
      normalizedRoomTypes.reduce(
        (sum, room) =>

          sum +

          (
            room.sharing *
            room.roomCount
          ),

        0
      );


    if (
      totalRooms <= 0 ||
      capacity <= 0
    ) {

      pgFormMessage.textContent =
        "Please enter valid room-sharing details.";


      pgFormMessage.style.color =
        "#d9534f";


      return;

    }


    // --------------------------------------
    // AMENITIES
    // --------------------------------------

    const amenitiesText =
      document
        .getElementById(
          "pgAmenities"
        )
        .value
        .trim();


    const amenities =
      amenitiesText

        ? amenitiesText
            .split(",")
            .map(
              (item) =>
                item.trim()
            )
            .filter(Boolean)

        : [];


    // --------------------------------------
    // LOCATION
    // --------------------------------------

    const latitudeValue =
      pgLatitude.value;


    const longitudeValue =
      pgLongitude.value;


    const location = {};


    if (
      latitudeValue !== ""
    ) {

      location.latitude =
        Number(
          latitudeValue
        );

    }


    if (
      longitudeValue !== ""
    ) {

      location.longitude =
        Number(
          longitudeValue
        );

    }


    // --------------------------------------
    // PG DATA
    // --------------------------------------

    const pgData = {

      name:
        document
          .getElementById(
            "pgName"
          )
          .value
          .trim(),


      description:
        document
          .getElementById(
            "pgDescription"
          )
          .value
          .trim(),


      address:
        document
          .getElementById(
            "pgAddress"
          )
          .value
          .trim(),


      city:
        document
          .getElementById(
            "pgCity"
          )
          .value
          .trim(),


      /*
        IMPORTANT:

        There is NO PG-level rent anymore.

        Rent belongs exclusively to:

          roomTypes[].rent
      */


      roomTypes:
        normalizedRoomTypes,


      /*
        These totals are also sent for
        dashboard convenience.

        The backend recalculates them
        again for safety.
      */

      totalRooms:
        totalRooms,


      capacity:
        capacity,


      // New PG starts with
      // every bed available.

      availableBeds:
        capacity,


      gender:
        document
          .getElementById(
            "pgGender"
          )
          .value,


      phone:
        document
          .getElementById(
            "pgPhone"
          )
          .value
          .trim(),


      amenities:
        amenities,


      images:
        [],


      location:
        location

    };


    // --------------------------------------
    // SEND TO BACKEND
    // --------------------------------------

    pgFormMessage.textContent =
      "Creating your PG...";


    pgFormMessage.style.color =
      "#0077b6";


    try {

      const response =
        await fetch(
          `${API_BASE_URL}/api/pgs`,
          {

            method:
              "POST",


            headers: {

              "Content-Type":
                "application/json",


              Authorization:
                `Bearer ${token}`

            },


            body:
              JSON.stringify(
                pgData
              )

          }
        );


      const data =
        await response.json();


      if (!response.ok) {

        console.error(
          "Create PG response:",
          data
        );


        pgFormMessage.textContent =
          data.message ||
          "Unable to create PG.";


        pgFormMessage.style.color =
          "#d9534f";


        return;

      }


      // ------------------------------------
      // SUCCESS
      // ------------------------------------

      pgFormMessage.textContent =
        "PG created successfully!";


      pgFormMessage.style.color =
        "#198754";


      await loadOwnerPGs();


      setTimeout(
        () => {

          closeModal();

        },
        700
      );


    } catch (error) {

      console.error(
        "Create PG error:",
        error
      );


      pgFormMessage.textContent =
        "Unable to connect to the server.";


      pgFormMessage.style.color =
        "#d9534f";

    }

  }
);


// ==========================================
// TOGGLES
// ==========================================

function setupToggle(id) {

  const button =
    document.getElementById(id);


  if (!button) {
    return;
  }


  button.addEventListener(
    "click",
    () => {

      button.classList.toggle(
        "off"
      );


      if (
        button.classList.contains(
          "off"
        )
      ) {

        button.textContent =
          "Turn On";

      } else {

        button.textContent =
          "Turn Off";

      }

    }
  );

}


setupToggle(
  "toggleWater"
);


setupToggle(
  "togglePower"
);


setupToggle(
  "toggleMess"
);


// ==========================================
// LOGOUT
// ==========================================

// ==========================================
// LOGOUT
// ==========================================

const logoutBtn =
  document.getElementById("logoutBtn");

if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    (event) => {

      event.preventDefault();

      // Remove authentication
      localStorage.removeItem("pgBuddieToken");
      localStorage.removeItem("pgBuddieUser");

      // Return to login
      window.location.href = "login.html";
    }
  );

}

// ==========================================
// COMPLAINTS
// ==========================================

const complaintsLink =
  document.getElementById(
    "complaintsLink"
  );


if (complaintsLink) {

  complaintsLink.addEventListener(
    "click",
    (event) => {

      event.preventDefault();


      alert(
        "Complaints section will be connected next."
      );

    }
  );

}


const viewComplaints =
  document.getElementById(
    "viewComplaints"
  );


if (viewComplaints) {

  viewComplaints.addEventListener(
    "click",
    () => {

      alert(
        "Complaints section will be connected next."
      );

    }
  );

}


// ==========================================
// NOTICE
// ==========================================

const addNoticeBtn =
  document.getElementById(
    "addNoticeBtn"
  );


if (addNoticeBtn) {

  addNoticeBtn.addEventListener(
    "click",
    () => {

      const notice =
        prompt(
          "Enter your notice:"
        );


      if (notice) {

        document.getElementById(
          "noticeText"
        ).textContent =
          notice;

      }

    }
  );

}


// ==========================================
// INITIALIZE
// ==========================================

loadOwnerInformation();

loadOwnerPGs();