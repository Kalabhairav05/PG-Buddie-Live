// ============================================================
// PG BUDDIE — STUDENT HOME
// ============================================================

"use strict";

const API_BASE_URL = "http://localhost:5000";


// ============================================================
// STATE
// ============================================================

let studentPGs = [];

let activePGId = null;

let currentLocation = null;

let activeFilters = {
    city: "",
    radius: 5,
    sharing: "",
    minRent: "",
    maxRent: "",
    gender: "",
    amenities: "",
    available: false
};


// ============================================================
// AUTH
// ============================================================

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


// ============================================================
// DOM ELEMENTS
// ============================================================

const studentNameElement =
    document.getElementById("studentName");

const logoutBtn =
    document.getElementById("logoutBtn");

const searchInput =
    document.getElementById("pgSearchInput");

const searchBtn =
    document.getElementById("pgSearchBtn");

const searchStatus =
    document.getElementById("pgSearchStatus");

const pgCards =
    document.getElementById("pgCards");


// ============================================================
// FILTER DOM
// ============================================================

const filterModal =
    document.getElementById("filterModal");

const filterBtn =
    document.getElementById("filterBtn");

const filterClose =
    document.getElementById("filterClose");

const filterCancel =
    document.getElementById("filterCancel");

const filterApply =
    document.getElementById("filterApply");

const filterReset =
    document.getElementById("filterReset");

const filterBadge =
    document.getElementById("filterBadge");

const filterCity =
    document.getElementById("filterCity");

const filterRadius =
    document.getElementById("filterRadius");

const filterSharing =
    document.getElementById("filterSharing");

const filterMinRent =
    document.getElementById("filterMinRent");

const filterMaxRent =
    document.getElementById("filterMaxRent");

const filterGender =
    document.getElementById("filterGender");

const filterAmenities =
    document.getElementById("filterAmenities");

const filterAvailable =
    document.getElementById("filterAvailable");

const useLocationBtn =
    document.getElementById("useLocationBtn");

const locationStatus =
    document.getElementById("locationStatus");


// ============================================================
// PG DETAILS MODAL
// ============================================================

const modal =
    document.getElementById("pgModal");

const modalImg =
    document.getElementById("modalImg");

const modalTitle =
    document.getElementById("modalTitle");

const modalDesc =
    document.getElementById("modalDesc");

const modalRent =
    document.getElementById("modalRent");

const modalAmenities =
    document.getElementById("modalAmenities");

const modalContact =
    document.getElementById("modalContact");

const modalClose =
    document.getElementById("modalClose");

const closeSecondary =
    document.getElementById("closeSecondary");


// ============================================================
// BOOKING
// ============================================================

const bookingPanel =
    document.getElementById("bookingPanel");

const openBookingBtn =
    document.getElementById("openBooking");

const cancelBookingBtn =
    document.getElementById("cancelBooking");

const submitBookingBtn =
    document.getElementById("submitBooking");

const bookingSuccess =
    document.getElementById("bookingSuccess");

const bookDate =
    document.getElementById("bookDate");


// ============================================================
// HELPERS
// ============================================================

function escapeHTML(value) {

    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function formatRent(value) {

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Rent unavailable";
    }

    return number.toLocaleString("en-IN");
}


function getPGImage(pg) {

    if (
        Array.isArray(pg?.images) &&
        pg.images.length > 0 &&
        pg.images[0]
    ) {
        return pg.images[0];
    }

    return "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000";
}


function getCheapestRoomType(pg) {

    /*
        Prefer rooms returned by the search route
        when available.
    */

    if (
        Array.isArray(pg?.matchingAvailableRooms) &&
        pg.matchingAvailableRooms.length > 0
    ) {

        const validRooms =
            pg.matchingAvailableRooms.filter(
                room =>
                    Number.isFinite(
                        Number(room?.rent)
                    )
            );

        if (validRooms.length > 0) {

            return validRooms.reduce(
                (cheapest, room) => {

                    if (!cheapest) {
                        return room;
                    }

                    return Number(room.rent) <
                        Number(cheapest.rent)
                        ? room
                        : cheapest;

                },
                null
            );
        }
    }


    /*
        Otherwise use normal roomTypes.
    */

    if (
        !Array.isArray(pg?.roomTypes) ||
        pg.roomTypes.length === 0
    ) {
        return null;
    }


    const valid =
        pg.roomTypes.filter(
            room =>
                Number.isFinite(
                    Number(room?.rent)
                )
        );


    if (valid.length === 0) {
        return null;
    }


    return valid.reduce(
        (cheapest, room) => {

            if (!cheapest) {
                return room;
            }

            return Number(room.rent) <
                Number(cheapest.rent)
                ? room
                : cheapest;

        },
        null
    );
}


// ============================================================
// STUDENT NAME
// ============================================================

function loadStudentName() {

    if (!studentNameElement) {
        return;
    }


    /*
        Read pgBuddieUser.
    */

    const storedUser =
        localStorage.getItem(
            "pgBuddieUser"
        );


    let currentUser = null;


    if (storedUser) {

        try {

            currentUser =
                JSON.parse(
                    storedUser
                );

        } catch (error) {

            console.error(
                "Unable to read pgBuddieUser:",
                error
            );

        }

    }


    /*
        Try several possible name fields.
    */

    const name =
        currentUser?.name ||
        currentUser?.fullName ||
        currentUser?.studentName ||
        currentUser?.username;


    if (name) {

        studentNameElement.textContent =
            name;

        return;

    }


    /*
        Do NOT overwrite a name that may have
        already been placed by another script.
    */

    if (
        !studentNameElement.textContent ||
        studentNameElement.textContent.trim() === "" ||
        studentNameElement.textContent.trim() === "Student"
    ) {

        studentNameElement.textContent =
            "Student";

    }

}


// ============================================================
// LOGOUT
// ============================================================

if (logoutBtn) {

    logoutBtn.addEventListener(
        "click",
        event => {

            event.preventDefault();

            localStorage.removeItem(
                "pgBuddieToken"
            );

            localStorage.removeItem(
                "pgBuddieUser"
            );

            window.location.replace(
                "login.html"
            );

        }
    );

}


// ============================================================
// SEARCH PLACEHOLDER ROTATION
// ============================================================

const searchHints = [

    "by name...",

    "by location...",

    "by PG name...",

    "by rent or sharing...",

    "by what you need...",

    "by amenities...",

    "by area near your university..."

];


let searchHintIndex = 0;


function updateSearchHint() {

    if (!searchInput) {
        return;
    }


    searchInput.placeholder =
        "Search " +
        searchHints[
            searchHintIndex
        ];

}


updateSearchHint();


setInterval(
    () => {

        if (!searchInput) {
            return;
        }


        /*
            Don't change the placeholder while
            the student is typing.
        */

        if (
            document.activeElement ===
            searchInput
        ) {
            return;
        }


        searchHintIndex =
            (
                searchHintIndex + 1
            ) %
            searchHints.length;


        /*
            Small transition class if the HTML
            contains it.
        */

        searchInput.classList.remove(
            "placeholder-changing"
        );


        void searchInput.offsetWidth;


        updateSearchHint();


        searchInput.classList.add(
            "placeholder-changing"
        );

    },
    2200
);


// ============================================================
// SEARCH STATUS
// ============================================================

function setSearchStatus(message) {

    if (searchStatus) {
        searchStatus.textContent =
            message;
    }

}


// ============================================================
// BUILD SEARCH PARAMETERS
// ============================================================

function buildSearchParams() {

    const params =
        new URLSearchParams();


    /*
        Main search box.

        Backend supports searching by
        PG name / city / address.
    */

    const search =
        searchInput
            ? searchInput.value.trim()
            : "";


    if (search) {

        params.set(
            "search",
            search
        );

    }


    /*
        City.
    */

    if (activeFilters.city) {

        params.set(
            "city",
            activeFilters.city
        );

    }


    /*
        Sharing.
    */

    if (
        activeFilters.sharing !== "" &&
        activeFilters.sharing !== null &&
        activeFilters.sharing !== undefined
    ) {

        params.set(
            "sharing",
            activeFilters.sharing
        );

    }


    /*
        Minimum rent.
    */

    if (
        activeFilters.minRent !== "" &&
        activeFilters.minRent !== null &&
        activeFilters.minRent !== undefined
    ) {

        params.set(
            "minRent",
            activeFilters.minRent
        );

    }


    /*
        Maximum rent.
    */

    if (
        activeFilters.maxRent !== "" &&
        activeFilters.maxRent !== null &&
        activeFilters.maxRent !== undefined
    ) {

        params.set(
            "maxRent",
            activeFilters.maxRent
        );

    }


    /*
        Gender.
    */

    if (activeFilters.gender) {

        params.set(
            "gender",
            activeFilters.gender
        );

    }


    /*
        Amenities.
    */

    if (activeFilters.amenities) {

        params.set(
            "amenities",
            activeFilters.amenities
        );

    }


    /*
        Available only.
    */

    if (activeFilters.available) {

        params.set(
            "available",
            "true"
        );

    }


    /*
        Location/radius.

        Only send coordinates when the
        browser actually provided them.
    */

    if (
        currentLocation &&
        Number.isFinite(
            Number(
                currentLocation.latitude
            )
        ) &&
        Number.isFinite(
            Number(
                currentLocation.longitude
            )
        )
    ) {

        params.set(
            "latitude",
            currentLocation.latitude
        );

        params.set(
            "longitude",
            currentLocation.longitude
        );

        params.set(
            "radius",
            activeFilters.radius || 5
        );

    }


    return params;

}


// ============================================================
// LOAD PGs
// ============================================================

async function loadPGs() {

    const params =
        buildSearchParams();


    setSearchStatus(
        "Finding PGs..."
    );


    if (pgCards) {

        pgCards.innerHTML = `

            <div class="pg-empty-state">

                <div class="pg-empty-icon">
                    🔎
                </div>

                <h3>
                    Finding PGs...
                </h3>

                <p>
                    Please wait.
                </p>

            </div>

        `;

    }


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/pgs/search?${params.toString()}`,
                {
                    method: "GET",

                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to search PGs."
            );

        }


        studentPGs =
            Array.isArray(data?.pgs)
                ? data.pgs
                : [];


        renderPGs(
            studentPGs
        );


        setSearchStatus(
            studentPGs.length +
            (
                studentPGs.length === 1
                    ? " PG found"
                    : " PGs found"
            )
        );


    } catch (error) {

        console.error(
            "PG search failed:",
            error
        );


        studentPGs = [];


        renderPGs([]);


        setSearchStatus(
            "Unable to load PGs. Please try again."
        );

    }

}


// ============================================================
// RENDER PGs
// ============================================================

function renderPGs(pgs) {

    if (!pgCards) {
        return;
    }


    pgCards.innerHTML = "";


    if (
        !Array.isArray(pgs) ||
        pgs.length === 0
    ) {

        pgCards.innerHTML = `

            <div class="pg-empty-state">

                <div class="pg-empty-icon">
                    🏠
                </div>

                <h3>
                    No PGs found
                </h3>

                <p>
                    Try another name, location,
                    or adjust your filters.
                </p>

            </div>

        `;


        return;

    }


    pgs.forEach(
        (pg, index) => {

            pgCards.appendChild(
                createPGCard(
                    pg,
                    index
                )
            );

        }
    );

}


// ============================================================
// CREATE PG CARD
// ============================================================

function createPGCard(
    pg,
    index
) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "pg-card";


    card.dataset.id =
        pg._id;


    card.style.animationDelay =
        `${0.08 + index * 0.08}s`;


    const room =
        getCheapestRoomType(pg);


    const reliability =
        Number(
            pg.ownerReliabilityScore
        );


    const availableBeds =
        Number(
            pg.matchingAvailableBeds ??
            pg.availableBeds ??
            0
        );


    const distance =
        Number(
            pg.distanceKm
        );


    const location =
        [
            pg.city,
            pg.address
        ]
            .filter(Boolean)
            .join(" • ");


    const distanceHTML =
        Number.isFinite(distance)
            ? `
                <span>
                    📍 ${distance} km
                </span>
              `
            : "";


    const rentHTML =
        room
            ? `
                <span>
                    ₹${formatRent(room.rent)}/mo
                </span>
              `
            : `
                <span>
                    Rent unavailable
                </span>
              `;


    const reliabilityHTML =
        Number.isFinite(reliability)
            ? `
                <span>
                    ⭐ ${reliability}
                </span>
              `
            : "";


    const locationHTML =
        location
            ? `
                <div class="pg-card-meta">
                    <span>
                        📍 ${escapeHTML(location)}
                    </span>
                </div>
              `
            : "";


    const sharing =
        room?.sharing ??
        room?.sharingType ??
        "-";


    card.innerHTML = `

        <img
            class="pg-card-image"
            src="${escapeHTML(
                getPGImage(pg)
            )}"
            alt="${escapeHTML(
                pg.name ||
                "PG"
            )}"
            loading="lazy"
        >


        <div class="pg-card-content">

            <h3 class="pg-card-title">

                ${escapeHTML(
                    pg.name ||
                    "Unnamed PG"
                )}

            </h3>


            <div class="pg-card-description">

                ${escapeHTML(
                    pg.description ||
                    "Student accommodation."
                )}

            </div>


            ${locationHTML}


            <div class="pg-card-meta">

                ${distanceHTML}

                ${reliabilityHTML}

                <span>
                    🛏 ${availableBeds} beds
                </span>

            </div>


            <div class="pg-card-meta">

                ${rentHTML}

                <span>
                    👥 ${escapeHTML(
                        sharing
                    )} sharing
                </span>

            </div>


            <div class="pg-card-actions">

                <button
                    class="viewBtn view-pg-btn"
                    type="button"
                >
                    View Details
                </button>

            </div>

        </div>

    `;


    const button =
        card.querySelector(
            ".viewBtn"
        );


    if (button) {

        button.addEventListener(
            "click",
            () => {

                openPGModal(
                    pg._id
                );

            }
        );

    }


    return card;

}


// ============================================================
// FILTER MODAL
// ============================================================

function openFilterModal() {

    if (!filterModal) {
        return;
    }


    fillFilterForm();


    filterModal.classList.add(
        "show"
    );


    filterModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";

}


function closeFilterModal() {

    if (!filterModal) {
        return;
    }


    filterModal.classList.remove(
        "show"
    );


    filterModal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";

}


if (filterBtn) {

    filterBtn.addEventListener(
        "click",
        openFilterModal
    );

}


if (filterClose) {

    filterClose.addEventListener(
        "click",
        closeFilterModal
    );

}


if (filterCancel) {

    filterCancel.addEventListener(
        "click",
        closeFilterModal
    );

}


if (filterModal) {

    filterModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                filterModal
            ) {

                closeFilterModal();

            }

        }
    );

}


// ============================================================
// FILTER FORM
// ============================================================

function fillFilterForm() {

    if (filterCity) {

        filterCity.value =
            activeFilters.city || "";

    }


    if (filterRadius) {

        filterRadius.value =
            activeFilters.radius || 5;

    }


    if (filterSharing) {

        filterSharing.value =
            activeFilters.sharing || "";

    }


    if (filterMinRent) {

        filterMinRent.value =
            activeFilters.minRent || "";

    }


    if (filterMaxRent) {

        filterMaxRent.value =
            activeFilters.maxRent || "";

    }


    if (filterGender) {

        filterGender.value =
            activeFilters.gender || "";

    }


    if (filterAmenities) {

        filterAmenities.value =
            activeFilters.amenities || "";

    }


    if (filterAvailable) {

        filterAvailable.checked =
            Boolean(
                activeFilters.available
            );

    }


    updateLocationStatus();

}


function collectFilters() {

    return {

        city:
            filterCity
                ? filterCity.value.trim()
                : "",


        radius:
            filterRadius
                ? Number(
                    filterRadius.value
                ) || 5
                : 5,


        sharing:
            filterSharing
                ? filterSharing.value
                : "",


        minRent:
            filterMinRent
                ? filterMinRent.value
                : "",


        maxRent:
            filterMaxRent
                ? filterMaxRent.value
                : "",


        gender:
            filterGender
                ? filterGender.value
                : "",


        amenities:
            filterAmenities
                ? filterAmenities.value.trim()
                : "",


        available:
            filterAvailable
                ? Boolean(
                    filterAvailable.checked
                )
                : false

    };

}


// ============================================================
// FILTER COUNT
// ============================================================

function getActiveFilterCount() {

    let count = 0;


    if (activeFilters.city) {
        count++;
    }


    if (activeFilters.sharing) {
        count++;
    }


    if (activeFilters.minRent) {
        count++;
    }


    if (activeFilters.maxRent) {
        count++;
    }


    if (activeFilters.gender) {
        count++;
    }


    if (activeFilters.amenities) {
        count++;
    }


    if (activeFilters.available) {
        count++;
    }


    if (currentLocation) {
        count++;
    }


    updateFilterBadge(
        count
    );


    return count;

}


function updateFilterBadge(
    count
) {

    if (!filterBadge) {
        return;
    }


    if (count > 0) {

        filterBadge.textContent =
            count;

        filterBadge.style.display =
            "inline-flex";

    } else {

        filterBadge.textContent =
            "";

        filterBadge.style.display =
            "none";

    }

}


// ============================================================
// APPLY FILTERS
// ============================================================

if (filterApply) {

    filterApply.addEventListener(
        "click",
        async () => {

            activeFilters =
                collectFilters();


            getActiveFilterCount();


            closeFilterModal();


            await loadPGs();

        }
    );

}


// ============================================================
// RESET FILTERS
// ============================================================

if (filterReset) {

    filterReset.addEventListener(
        "click",
        async () => {

            activeFilters = {

                city: "",

                radius: 5,

                sharing: "",

                minRent: "",

                maxRent: "",

                gender: "",

                amenities: "",

                available: false

            };


            currentLocation =
                null;


            fillFilterForm();


            updateFilterBadge(
                0
            );


            await loadPGs();

        }
    );

}


// ============================================================
// CURRENT LOCATION
// ============================================================

if (useLocationBtn) {

    useLocationBtn.addEventListener(
        "click",
        useCurrentLocation
    );

}


function useCurrentLocation() {

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


    useLocationBtn.disabled =
        true;


    navigator.geolocation.getCurrentPosition(

        position => {

            currentLocation = {

                latitude:
                    position.coords.latitude,

                longitude:
                    position.coords.longitude

            };


            setLocationStatus(
                "📍 Current location selected"
            );


            useLocationBtn.disabled =
                false;


            getActiveFilterCount();

        },


        error => {

            console.error(
                "Location error:",
                error
            );


            currentLocation =
                null;


            setLocationStatus(
                "Unable to get your location. Please allow location access."
            );


            useLocationBtn.disabled =
                false;

        },

        {

            enableHighAccuracy:
                true,

            timeout:
                10000,

            maximumAge:
                60000

        }

    );

}


function setLocationStatus(
    message
) {

    if (locationStatus) {

        locationStatus.textContent =
            message;

    }

}


function updateLocationStatus() {

    if (
        currentLocation
    ) {

        setLocationStatus(
            "📍 Current location selected"
        );

    } else {

        setLocationStatus(
            "No location selected"
        );

    }

}


// ============================================================
// MAIN SEARCH
// ============================================================

if (searchBtn) {

    searchBtn.addEventListener(
        "click",
        loadPGs
    );

}


if (searchInput) {

    searchInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                event.preventDefault();

                loadPGs();

            }

        }
    );

}


// ============================================================
// PG DETAILS MODAL
// ============================================================

function openPGModal(
    pgId
) {

    const pg =
        studentPGs.find(
            item =>
                String(item._id) ===
                String(pgId)
        );


    if (
        !pg ||
        !modal
    ) {

        return;

    }


    activePGId =
        pg._id;


    const room =
        getCheapestRoomType(
            pg
        );


    if (modalImg) {

        modalImg.src =
            getPGImage(pg);

        modalImg.alt =
            pg.name ||
            "PG";

    }


    if (modalTitle) {

        modalTitle.textContent =
            pg.name ||
            "PG";

    }


    if (modalDesc) {

        modalDesc.textContent =
            pg.description ||
            pg.address ||
            "Student accommodation.";

    }


    if (modalRent) {

        /*
            IMPORTANT:

            HTML already has ₹ before modalRent,
            so JS must NOT add another ₹.
        */

        modalRent.textContent =
            room
                ? formatRent(
                    room.rent
                )
                : "Rent unavailable";

    }


    if (modalContact) {

        modalContact.textContent =
            pg.phone
                ? "Contact: " + pg.phone
                : (
                    pg.contact
                        ? "Contact: " + pg.contact
                        : (
                            pg.address ||
                            "Contact unavailable"
                        )
                );

    }


    if (modalAmenities) {

        const amenities =
            Array.isArray(
                pg.amenities
            )
                ? pg.amenities
                : [];


        modalAmenities.innerHTML =
            amenities.length > 0

                ? amenities
                    .map(
                        amenity =>
                            `<li>${escapeHTML(
                                amenity
                            )}</li>`
                    )
                    .join("")

                : "<li>No amenities listed.</li>";

    }


    if (bookingPanel) {

        bookingPanel.style.display =
            "none";

    }


    if (openBookingBtn) {

        openBookingBtn.style.display =
            "inline-block";

    }


    if (bookingSuccess) {

        bookingSuccess.style.display =
            "none";

    }


    if (submitBookingBtn) {

        submitBookingBtn.style.display =
            "inline-block";

        submitBookingBtn.disabled =
            false;

    }


    if (bookDate) {

        bookDate.value =
            "";


        bookDate.min =
            new Date()
                .toISOString()
                .split("T")[0];

    }


    modal.classList.add(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.style.overflow =
        "hidden";

}


function closePGModal() {

    if (!modal) {
        return;
    }


    modal.classList.remove(
        "show"
    );


    modal.setAttribute(
        "aria-hidden",
        "true"
    );


    document.body.style.overflow =
        "";

}


if (modalClose) {

    modalClose.addEventListener(
        "click",
        closePGModal
    );

}


if (closeSecondary) {

    closeSecondary.addEventListener(
        "click",
        closePGModal
    );

}


if (modal) {

    modal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                modal
            ) {

                closePGModal();

            }

        }
    );

}


// ============================================================
// BOOKING PANEL
// ============================================================

if (openBookingBtn) {

    openBookingBtn.addEventListener(
        "click",
        () => {

            if (bookingPanel) {

                bookingPanel.style.display =
                    "block";

            }

        }
    );

}


if (cancelBookingBtn) {

    cancelBookingBtn.addEventListener(
        "click",
        () => {

            if (bookingPanel) {

                bookingPanel.style.display =
                    "none";

            }


            if (openBookingBtn) {

                openBookingBtn.style.display =
                    "inline-block";

            }

        }
    );

}


// ============================================================
// SUBMIT BOOKING
// ============================================================

if (submitBookingBtn) {

    submitBookingBtn.addEventListener(
        "click",
        submitBooking
    );

}


async function submitBooking() {

    const token =
        requireToken();


    if (!token) {
        return;
    }


    if (!activePGId) {

        alert(
            "Please select a PG first."
        );

        return;

    }


    if (!bookDate?.value) {

        alert(
            "Please select a check-in date."
        );

        return;

    }


    const pg =
        studentPGs.find(
            item =>
                String(item._id) ===
                String(activePGId)
        );


    if (!pg) {

        alert(
            "PG information is no longer available."
        );

        return;

    }


    const room =
        getCheapestRoomType(
            pg
        );


    if (!room) {

        alert(
            "No room information is available for this PG."
        );

        return;

    }


    const requestedSharing =
        Number(
            room.sharing ??
            room.sharingType
        );


    const requestedRent =
        Number(
            room.rent
        );


    if (
        !Number.isFinite(
            requestedSharing
        )
    ) {

        alert(
            "Unable to determine room sharing."
        );

        return;

    }


    if (
        !Number.isFinite(
            requestedRent
        )
    ) {

        alert(
            "Unable to determine room rent."
        );

        return;

    }


    submitBookingBtn.disabled =
        true;


    submitBookingBtn.textContent =
        "Sending...";


    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/bookings`,
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${token}`

                    },

                    body:
                        JSON.stringify({

                            pg:
                                pg._id,

                            requestedSharing:
                                requestedSharing,

                            requestedRent:
                                requestedRent,

                            requestedCheckInDate:
                                bookDate.value

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data?.message ||
                "Unable to create booking."
            );

        }


        if (bookingSuccess) {

            bookingSuccess.textContent =
                "Booking request sent successfully!";

            bookingSuccess.style.display =
                "block";

        }


        submitBookingBtn.style.display =
            "none";


    } catch (error) {

        console.error(
            "Booking error:",
            error
        );


        alert(
            error.message ||
            "Unable to send booking request."
        );


    } finally {

        submitBookingBtn.disabled =
            false;


        submitBookingBtn.textContent =
            "Submit Booking";

    }

}


// ============================================================
// ESCAPE KEY
// ============================================================

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key !==
            "Escape"
        ) {

            return;

        }


        closePGModal();

        closeFilterModal();

    }
);


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        loadStudentName();


        updateFilterBadge(
            0
        );


        await loadPGs();

    }
);