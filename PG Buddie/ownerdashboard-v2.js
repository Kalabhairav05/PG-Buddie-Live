const API_BASE_URL = "http://localhost:5000";

let ownerPGs = [];
let selectedPG = null;


/* =====================================================
   GET ELEMENTS
===================================================== */

const pgSelector = document.getElementById("pgSelector");
const pgContext = document.getElementById("pgContext");
const pgList = document.getElementById("pgList");

const ownerName = document.getElementById("ownerName");

const residentCount = document.getElementById("residentCount");
const occupancy = document.getElementById("occupancy");
const availableBeds = document.getElementById("availableBeds");
const capacity = document.getElementById("capacity");
const rent = document.getElementById("rent");
const verification = document.getElementById("verification");

const addPgBtn = document.getElementById("addPgBtn");
const logoutBtn = document.getElementById("logoutBtn");

const pgModal = document.getElementById("pgModal");
const closePgModal = document.getElementById("closePgModal");
const cancelPgBtn = document.getElementById("cancelPgBtn");

const pgForm = document.getElementById("pgForm");
const pgFormMessage = document.getElementById("pgFormMessage");


/* =====================================================
   INITIAL CHECK
===================================================== */

console.log("PG-Buddie owner dashboard JS loaded.");

console.log("Add PG button:", addPgBtn);
console.log("PG modal:", pgModal);
console.log("PG form:", pgForm);


/* =====================================================
   BASIC ELEMENT SAFETY
===================================================== */

if (!addPgBtn) {
  console.error("ERROR: addPgBtn was not found.");
}

if (!pgModal) {
  console.error("ERROR: pgModal was not found.");
}

if (!pgForm) {
  console.error("ERROR: pgForm was not found.");
}


/* =====================================================
   GET TOKEN
===================================================== */

function getToken() {
  const token = localStorage.getItem("pgBuddieToken");

  if (!token) {
    console.error("No authentication token found.");

    window.location.href = "login.html";

    return null;
  }

  return token;
}


/* =====================================================
   LOAD OWNER
===================================================== */

async function loadOwner() {

  const token = getToken();

  if (!token) {
    return;
  }

  try {

    const response = await fetch(
      `${API_BASE_URL}/api/auth/me`,
      {
        method: "GET",

        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    console.log("Owner response:", data);

    if (!response.ok) {
      throw new Error(
        data.message || "Authentication failed."
      );
    }

    if (data.user) {

      ownerName.textContent =
        data.user.name || "Owner";

    }

  } catch (error) {

    console.error(
      "Unable to load owner:",
      error
    );

  }
}


/* =====================================================
   LOAD OWNER'S PGs
===================================================== */

async function loadOwnerPGs() {

  const token = getToken();

  if (!token) {
    return;
  }

  try {

    pgList.innerHTML = `
      <div class="loading">
        Loading your PGs...
      </div>
    `;

    const response = await fetch(
      `${API_BASE_URL}/api/pgs/my`,
      {
        method: "GET",

        headers: {
          "Authorization": `Bearer ${token}`
        }
      }
    );

    const data = await response.json();

    console.log("Owner PG response:", data);

    if (!response.ok) {

      throw new Error(
        data.message ||
        "Unable to load your PGs."
      );

    }

    ownerPGs = data.pgs || [];

    renderPGSelector();

    renderPGCards();

    if (ownerPGs.length > 0) {

      selectPG(ownerPGs[0]._id);

    } else {

      showNoPGSelected();

    }

  } catch (error) {

    console.error(
      "PG loading error:",
      error
    );

    pgList.innerHTML = `
      <div class="error-state">

        <strong>
          Unable to load your PGs.
        </strong>

        <p>
          ${escapeHTML(error.message)}
        </p>

      </div>
    `;

  }
}


/* =====================================================
   RENDER PG SELECTOR
===================================================== */

function renderPGSelector() {

  pgSelector.innerHTML = "";

  if (ownerPGs.length === 0) {

    pgSelector.innerHTML = `
      <option value="">
        No PGs yet
      </option>
    `;

    return;
  }

  ownerPGs.forEach((pg) => {

    const option =
      document.createElement("option");

    option.value = pg._id;

    option.textContent =
      `${pg.name} — ${pg.city}`;

    pgSelector.appendChild(option);

  });
}


/* =====================================================
   RENDER PG CARDS
===================================================== */

function renderPGCards() {

  if (ownerPGs.length === 0) {

    pgList.innerHTML = `
      <div class="empty-state">

        <h3>
          You haven't added a PG yet.
        </h3>

        <p>
          Create your first PG listing
          so students can eventually
          discover it.
        </p>

        <button
          class="primary-btn"
          id="firstPgButton"
          type="button"
        >
          + Add Your First PG
        </button>

      </div>
    `;

    const firstPgButton =
      document.getElementById("firstPgButton");

    if (firstPgButton) {

      firstPgButton.addEventListener(
        "click",
        openPgModal
      );

    }

    return;
  }


  pgList.innerHTML = "";


  ownerPGs.forEach((pg) => {

    const occupied =
      Math.max(
        0,
        pg.capacity - pg.availableBeds
      );


    const card =
      document.createElement("div");

    card.className = "pg-card";


    card.innerHTML = `

      <span class="badge">

        ${
          pg.isVerified
            ? "Verified"
            : "Verification Pending"
        }

      </span>

      <h3>
        ${escapeHTML(pg.name)}
      </h3>

      <p>
        📍
        ${escapeHTML(pg.address)},
        ${escapeHTML(pg.city)}
      </p>

      <p>
        👥
        ${occupied}
        /
        ${pg.capacity}
        occupied
      </p>

      <p>
        🛏️
        ${pg.availableBeds}
        beds available
      </p>

      <p>
        💰
        ₹${Number(pg.rent).toLocaleString("en-IN")}
        / month
      </p>

    `;


    card.addEventListener(
      "click",
      () => {

        selectPG(pg._id);

      }
    );


    pgList.appendChild(card);

  });

}


/* =====================================================
   SELECT PG
===================================================== */

function selectPG(pgId) {

  selectedPG =
    ownerPGs.find(
      (pg) => pg._id === pgId
    );


  if (!selectedPG) {

    showNoPGSelected();

    return;
  }


  pgSelector.value =
    selectedPG._id;


  const occupied =
    Math.max(
      0,
      selectedPG.capacity -
      selectedPG.availableBeds
    );


  const occupancyPercentage =
    selectedPG.capacity > 0
      ? Math.round(
          (occupied /
            selectedPG.capacity) *
          100
        )
      : 0;


  pgContext.innerHTML = `

    <strong>
      🏠
      ${escapeHTML(selectedPG.name)}
    </strong>

    <span>
      📍
      ${escapeHTML(selectedPG.address)},
      ${escapeHTML(selectedPG.city)}
    </span>

  `;


  residentCount.textContent =
    occupied;


  occupancy.textContent =
    `${occupancyPercentage}%`;


  availableBeds.textContent =
    selectedPG.availableBeds;


  capacity.textContent =
    selectedPG.capacity;


  rent.textContent =
    `₹${Number(
      selectedPG.rent
    ).toLocaleString("en-IN")}`;


  verification.textContent =
    selectedPG.isVerified
      ? "Verified"
      : "Pending";

}


/* =====================================================
   EMPTY PG STATE
===================================================== */

function showNoPGSelected() {

  selectedPG = null;


  pgContext.innerHTML = `

    <strong>
      No PG selected
    </strong>

    <span>
      Add a PG to start managing
      your accommodation.
    </span>

  `;


  residentCount.textContent =
    "0";

  occupancy.textContent =
    "0%";

  availableBeds.textContent =
    "0";

  capacity.textContent =
    "0";

  rent.textContent =
    "₹0";

  verification.textContent =
    "Pending";

}


/* =====================================================
   OPEN ADD PG MODAL
===================================================== */

function openPgModal() {

  console.log(
    "Opening Add PG modal..."
  );


  if (!pgModal) {

    console.error(
      "Cannot open modal: pgModal missing."
    );

    return;
  }


  if (pgForm) {

    pgForm.reset();

  }


  if (pgFormMessage) {

    pgFormMessage.textContent = "";

  }


  pgModal.classList.add("show");


  document.body.style.overflow =
    "hidden";

}


/* =====================================================
   CLOSE ADD PG MODAL
===================================================== */

function closePgForm() {

  console.log(
    "Closing Add PG modal..."
  );


  if (!pgModal) {
    return;
  }


  pgModal.classList.remove("show");


  document.body.style.overflow =
    "";

}


/* =====================================================
   ADD PG BUTTON
===================================================== */

if (addPgBtn) {

  addPgBtn.addEventListener(
    "click",
    openPgModal
  );

}


/* =====================================================
   CLOSE BUTTON
===================================================== */

if (closePgModal) {

  closePgModal.addEventListener(
    "click",
    closePgForm
  );

}


/* =====================================================
   CANCEL BUTTON
===================================================== */

if (cancelPgBtn) {

  cancelPgBtn.addEventListener(
    "click",
    closePgForm
  );

}


/* =====================================================
   CLICK OUTSIDE MODAL
===================================================== */

if (pgModal) {

  pgModal.addEventListener(
    "click",
    (event) => {

      if (
        event.target === pgModal
      ) {

        closePgForm();

      }

    }
  );

}


/* =====================================================
   ESCAPE KEY
===================================================== */

document.addEventListener(
  "keydown",
  (event) => {

    if (
      event.key === "Escape" &&
      pgModal &&
      pgModal.classList.contains("show")
    ) {

      closePgForm();

    }

  }
);


/* =====================================================
   PG FORM SUBMISSION
===================================================== */

if (pgForm) {

  pgForm.addEventListener(
    "submit",
    async (event) => {

      event.preventDefault();


      console.log(
        "Create PG form submitted."
      );


      const token =
        getToken();


      if (!token) {
        return;
      }


      const capacityValue =
        Number(
          document.getElementById(
            "pgCapacity"
          ).value
        );


      const availableBedsValue =
        Number(
          document.getElementById(
            "pgAvailableBeds"
          ).value
        );


      if (
        availableBedsValue >
        capacityValue
      ) {

        pgFormMessage.textContent =
          "Available beds cannot be greater than total capacity.";

        return;
      }


      const latitudeValue =
        document.getElementById(
          "pgLatitude"
        ).value;


      const longitudeValue =
        document.getElementById(
          "pgLongitude"
        ).value;


      const amenities = [

        ...document.querySelectorAll(
          '.amenities input[type="checkbox"]:checked'
        )

      ].map(
        (input) =>
          input.value
      );


      const pgData = {

        name:
          document.getElementById(
            "pgName"
          ).value.trim(),

        description:
          document.getElementById(
            "pgDescription"
          ).value.trim(),

        address:
          document.getElementById(
            "pgAddress"
          ).value.trim(),

        city:
          document.getElementById(
            "pgCity"
          ).value.trim(),

        rent:
          Number(
            document.getElementById(
              "pgRent"
            ).value
          ),

        totalRooms:
          Number(
            document.getElementById(
              "pgRooms"
            ).value
          ),

        capacity:
          capacityValue,

        availableBeds:
          availableBedsValue,

        gender:
          document.getElementById(
            "pgGender"
          ).value,

        phone:
          document.getElementById(
            "pgPhone"
          ).value.trim(),

        amenities:
          amenities

      };


      /*
        Only send location if both
        coordinates were provided.
      */

      if (
        latitudeValue !== "" &&
        longitudeValue !== ""
      ) {

        pgData.location = {

          latitude:
            Number(latitudeValue),

          longitude:
            Number(longitudeValue)

        };

      }


      console.log(
        "Sending PG data:",
        pgData
      );


      const submitButton =
        pgForm.querySelector(
          ".primary-submit"
        );


      if (submitButton) {

        submitButton.disabled =
          true;

        submitButton.textContent =
          "Creating...";

      }


      pgFormMessage.textContent =
        "";


      try {

        const response =
          await fetch(
            `${API_BASE_URL}/api/pgs`,
            {

              method: "POST",

              headers: {

                "Content-Type":
                  "application/json",

                "Authorization":
                  `Bearer ${token}`

              },

              body:
                JSON.stringify(pgData)

            }
          );


        const data =
          await response.json();


        console.log(
          "Create PG response:",
          data
        );


        if (!response.ok) {

          throw new Error(
            data.message ||
            "Unable to create PG."
          );

        }


        pgFormMessage.textContent =
          "PG created successfully! 🏠";


        /*
          Reload PGs from MongoDB.
        */

        await loadOwnerPGs();


        /*
          Close modal after
          successful creation.
        */

        setTimeout(
          () => {

            closePgForm();

          },
          700
        );


      } catch (error) {

        console.error(
          "Create PG error:",
          error
        );


        pgFormMessage.textContent =
          error.message ||
          "Something went wrong.";

      } finally {

        if (submitButton) {

          submitButton.disabled =
            false;

          submitButton.textContent =
            "Create PG";

        }

      }

    }
  );

}


/* =====================================================
   PG SELECTOR CHANGE
===================================================== */

if (pgSelector) {

  pgSelector.addEventListener(
    "change",
    () => {

      selectPG(
        pgSelector.value
      );

    }
  );

}


/* =====================================================
   LOGOUT
===================================================== */

if (logoutBtn) {

  logoutBtn.addEventListener(
    "click",
    (event) => {

      event.preventDefault();


      localStorage.removeItem(
        "pgBuddieToken"
      );


      localStorage.removeItem(
        "pgBuddieUser"
      );


      window.location.href =
        "login.html";

    }
  );

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHTML(value) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =====================================================
   INITIALIZE DASHBOARD
===================================================== */

async function initDashboard() {

  console.log(
    "Initializing PG-Buddie owner dashboard..."
  );


  await loadOwner();


  await loadOwnerPGs();


  console.log(
    "Dashboard initialization complete."
  );

}


initDashboard();