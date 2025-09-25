   // Firebase SDK Imports
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        import { getDatabase, ref, set, onValue, remove, update, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-database.js";
        import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

        // --- Global Firebase Variables (Provided by Canvas Environment) ---
        // Using the user-provided Firebase configuration
        const firebaseConfig = {
            apiKey: "AIzaSyD-GCRFbpLQwU55kShhS-DtNSNOPEySQ_g",
            authDomain: "octen-29d12.firebaseapp.com",
            databaseURL: "https://octen-29d12-default-rtdb.firebaseio.com",
            projectId: "octen-29d12",
            storageBucket: "octen-29d12.appspot.com",
            messagingSenderId: "1095439842170",
            appId: "1:1095439842170:web:da0dc8a2c414c60f33f4c3",
            measurementId: "G-483MYXKNVL"
        };
        // Using project ID as a logical appId for data paths, though not directly used in the new RTDB path structure
        const appId = firebaseConfig.projectId; 

        // --- Firebase Instances ---
        let app, auth, db, storage, rtdb;
        let userId = null;
        let isAuthReady = false;
        let currentUserEmailVerified = false;
        let currentUsername = ''; // To store the username from RTDB

        // --- Recent Activity Pagination State ---
        let currentPage = 1;
        const itemsPerPage = 5; // Number of activity items per page
        let allActivityData = []; // To store all fetched activity data

        // --- Utility Functions ---
        /**
         * Displays an island-like notification at the top of the screen.
         * @param {string} message - The message text.
         * @param {boolean} [isError=false] - Whether the message is an error (applies red background).
         * @param {boolean} [persist=false] - If true, the notification will not automatically hide.
         */
        function showIslandNotification(message, isError = false, persist = false) {
            const notificationIsland = document.getElementById('notificationIsland');
            notificationIsland.textContent = message;
            notificationIsland.className = 'notification-island show'; // Reset classes
            if (isError) {
                notificationIsland.classList.add('error');
            } else {
                notificationIsland.classList.remove('error'); // Ensure error class is removed for non-errors
            }

            // Clear any existing timeout to prevent conflicts if called rapidly or to stop a persistent one
            clearTimeout(notificationIsland.dataset.timeoutId);

            if (!persist) {
                const timeoutId = setTimeout(() => {
                    notificationIsland.classList.remove('show');
                    setTimeout(() => {
                        notificationIsland.textContent = '';
                    }, 300); // Match CSS transition duration
                }, 5000);
                notificationIsland.dataset.timeoutId = timeoutId; // Store timeout ID
            }
            // If persist is true, no timeout is set, so it stays visible
        }

        /**
         * Uploads a file to Firebase Storage and returns its download URL.
         * @param {File} file - The file to upload.
         * @param {string} path - The storage path (e.g., `users/${userId}/images`).
         * @returns {Promise<string|null>} - The download URL of the uploaded file, or null if no file.
         */
        async function uploadImage(file, path) {
            if (!file) return null;
            const fileRef = storageRef(storage, `${path}/${file.name}_${Date.now()}`);
            await uploadBytes(fileRef, file);
            return await getDownloadURL(fileRef);
        }

        /**
         * Sets up a custom file input listener.
         * @param {string} inputId - The ID of the hidden file input.
         * @param {string} fileNameId - The ID of the span to display the file name.
         * @param {string} previewId - The ID of the image preview element (optional).
         */
        function setupCustomFileInput(inputId, fileNameId, previewId = null) {
            const fileInput = document.getElementById(inputId);
            const fileNameSpan = document.getElementById(fileNameId);
            const previewImage = previewId ? document.getElementById(previewId) : null;

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    fileNameSpan.textContent = e.target.files[0].name;
                    if (previewImage) {
                        previewImage.src = URL.createObjectURL(e.target.files[0]);
                        previewImage.style.display = 'block';
                    }
                } else {
                    fileNameSpan.textContent = 'No file chosen';
                    if (previewImage) {
                        previewImage.src = '';
                        previewImage.style.display = 'none';
                    }
                }
            });
        }

        /**
         * Copies text to the clipboard.
         * @param {string} text - The text to copy.
         */
        function copyTextToClipboard(text) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showIslandNotification('Link copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy text: ', err);
                showIslandNotification('Failed to copy link.', true);
            }
            document.body.removeChild(textarea);
        }


        // --- Firebase Initialization ---
        /**
         * Initializes Firebase and authenticates the user.
         * Sets up an auth state listener to update userId and isAuthReady.
         * @returns {Promise<void>}
         */
        async function initializeFirebase() {
            try {
                app = initializeApp(firebaseConfig);
                auth = getAuth(app);
                rtdb = getDatabase(app);
                storage = getStorage(app); 
                db = getFirestore(app); 

                return new Promise((resolve) => {
                    onAuthStateChanged(auth, (user) => {
                        if (user) {
                            userId = user.uid;
                            currentUserEmailVerified = user.emailVerified;
                            console.log("Authenticated user ID:", userId, "Email Verified:", currentUserEmailVerified);
                            isAuthReady = true;
                            // Hide "Not logged in" notification if it was showing
                            showIslandNotification('', false, false); // Clear and hide any persistent notification
                        } else {
                            userId = null; // Ensure userId is null if not authenticated
                            isAuthReady = false;
                            console.log("User not logged in. Redirecting to auth.html (console log only).");
                            console.log("Redirecting to auth.html"); // Explicitly log redirect
                            window.location.href = 'auth.html'; // Redirect to auth page
                            showIslandNotification('Not logged in', true, true); // Show persistent error notification
                        }
                        resolve(); // Resolve the promise once auth state is determined
                    });
                });

            } catch (error) {
                console.error("Error initializing Firebase:", error);
                showIslandNotification(`Firebase init error: ${error.message}`, true);
                throw error; // Re-throw to indicate initialization failure
            }
        }

        // --- Tab Navigation Logic ---
        /**
         * Initializes the tab navigation functionality.
         * Sets up event listeners for tab buttons to switch content with animations.
         */
        function initTabNavigation() {
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
            const transitionDuration = 300; // Match CSS transition duration

            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    const currentActiveButton = document.querySelector('.tab-button.active');
                    const currentActiveContent = document.querySelector('.tab-content.active');
                    const targetTab = button.dataset.tab;
                    const newActiveContent = document.getElementById(targetTab);

                    // Deactivate current tab and content
                    if (currentActiveButton) {
                        currentActiveButton.classList.remove('active');
                        currentActiveButton.setAttribute('aria-selected', 'false');
                    }
                    if (currentActiveContent) {
                        currentActiveContent.classList.remove('active'); // Start fade-out/slide-out
                        currentActiveContent.setAttribute('hidden', '');
                        // After transition, set display to none
                        setTimeout(() => {
                            currentActiveContent.style.display = 'none';
                        }, transitionDuration);
                    }

                    // Activate new tab button
                    button.classList.add('active');
                    button.setAttribute('aria-selected', 'true');

                    // Activate new tab content
                    newActiveContent.style.display = 'block'; // Set display to block immediately
                    newActiveContent.removeAttribute('hidden');
                    // Force reflow to ensure display:block is applied before transition starts
                    void newActiveContent.offsetWidth;
                    newActiveContent.classList.add('active'); // Trigger fade-in/slide-in

                    // If navigating to overview, ensure its content is loaded/updated
                    if (targetTab === 'overview' && isAuthReady && userId) {
                        loadOverviewContent();
                    }
                    if (targetTab === 'activate-card' && isAuthReady && userId) {
                        loadCardOrderStatus();
                    }
                });
            });

            // The HTML already sets 'active' for overview.
            // The `loadOverviewContent` will be explicitly called after Firebase init.
        }

        // --- Appearance Tab Logic ---
        /**
         * Initializes the appearance management functionality.
         * Sets up form submission, image previews, and loads existing settings.
         */
        function initAppearanceManager() {
            const appearanceForm = document.getElementById('appearanceForm');
            const profileNameInput = document.getElementById('profileNameInput'); // New
            const profileIntroInput = document.getElementById('profileIntroInput'); // New
            const backgroundImageInput = document.getElementById('backgroundImage');
            const backgroundImagePreview = document.getElementById('backgroundImagePreview');
            const heroImageInput = document.getElementById('heroImage');
            const heroImagePreview = document.getElementById('heroImagePreview');
            const profileImageInput = document.getElementById('profileImage');
            const profileImagePreview = document.getElementById('profileImagePreview');
            const appearanceLoading = document.getElementById('appearanceLoading');
            const backgroundColorPalette = document.getElementById('backgroundColorPalette');
            const selectedBackgroundColorInput = document.getElementById('selectedBackgroundColor');

            // Define the 10 subtle background colors
            const subtleColors = [
                '#F8F8F8', '#F0F4F7', '#E8F0F3', '#E0EAEF', '#D8E4E8',
                '#FDF6E3', '#F7EDD9', '#EFE4D0', '#E7DBC7', '#DFD2BE'
            ];

            // Generate color squares
            subtleColors.forEach(color => {
                const colorSquare = document.createElement('div');
                colorSquare.className = 'color-square';
                colorSquare.style.backgroundColor = color;
                colorSquare.dataset.color = color;
                colorSquare.setAttribute('role', 'button');
                colorSquare.setAttribute('tabindex', '0');
                colorSquare.setAttribute('aria-label', `Select background color ${color}`);
                colorSquare.addEventListener('click', () => {
                    // Remove 'selected' from all squares
                    document.querySelectorAll('.color-square').forEach(sq => sq.classList.remove('selected'));
                    // Add 'selected' to clicked square
                    colorSquare.classList.add('selected');
                    selectedBackgroundColorInput.value = color; // Set hidden input value
                    backgroundImageInput.value = ''; // Clear file input if color is selected
                    backgroundImagePreview.src = '';
                    backgroundImagePreview.style.display = 'none';
                    document.getElementById('backgroundImageFileName').textContent = 'No file chosen';
                });
                colorSquare.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        colorSquare.click();
                    }
                });
                backgroundColorPalette.appendChild(colorSquare);
            });

            // Setup custom file inputs
            setupCustomFileInput('backgroundImage', 'backgroundImageFileName', 'backgroundImagePreview');
            setupCustomFileInput('heroImage', 'heroImageFileName', 'heroImagePreview');
            setupCustomFileInput('profileImage', 'profileImageFileName', 'profileImagePreview');

            appearanceForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAuthReady || !userId) {
                    showIslandNotification('User not authenticated. Please wait.', true);
                    return;
                }

                appearanceLoading.style.display = 'inline-block';
                const appearanceData = {};
                const profileData = {};

                try {
                    // Handle profile name and intro
                    profileData.name = profileNameInput.value;
                    profileData.intro = profileIntroInput.value;

                    // Handle background image upload
                    const backgroundImageFile = backgroundImageInput.files[0];
                    if (backgroundImageFile) {
                        const imageUrl = await uploadImage(backgroundImageFile, `users/${userId}/appearance/backgrounds`);
                        appearanceData.backgroundImage = imageUrl;
                        appearanceData.backgroundColor = ''; // Clear color if image is chosen
                    } else if (selectedBackgroundColorInput.value) { // Only set color if one is selected
                        appearanceData.backgroundColor = selectedBackgroundColorInput.value;
                        appearanceData.backgroundImage = ''; // Clear image if color is chosen
                    }
                    // If neither image nor color is selected, don't update these fields in appearanceData

                    // Handle hero image upload
                    const heroImageFile = heroImageInput.files[0];
                    if (heroImageFile) {
                        const imageUrl = await uploadImage(heroImageFile, `users/${userId}/appearance/hero`);
                        appearanceData.heroImage = imageUrl;
                    }
                    // If no new hero image, do not include heroImage in appearanceData to avoid overwriting

                    // Handle profile image upload
                    const profileImageFile = profileImageInput.files[0];
                    if (profileImageFile) {
                        const imageUrl = await uploadImage(profileImageFile, `users/${userId}/appearance/profile`);
                        appearanceData.profileImage = imageUrl;
                    }
                    // If no new profile image, do not include profileImage in appearanceData to avoid overwriting

                    // Get other form data
                    appearanceData.fontFamily = document.getElementById('fontFamily').value;

                    // Save to Realtime Database using update to only change specified fields
                    const appearanceRef = ref(rtdb, `users/${userId}/appearance`);
                    await update(appearanceRef, appearanceData); // Use update for partial updates

                    const profileRef = ref(rtdb, `users/${userId}/profile`);
                    await update(profileRef, profileData); // Use update for partial updates

                    showIslandNotification('Appearance settings saved successfully!');

                } catch (error) {
                    console.error("Error saving appearance settings:", error);
                    showIslandNotification(`Error saving settings: ${error.message}`, true);
                } finally {
                    appearanceLoading.style.display = 'none';
                }
            });

            /**
             * Loads appearance settings and profile data from Firebase Realtime Database.
             */
            function loadAppearanceSettings() {
                if (!userId) return;

                // Load Appearance Data
                const appearanceRef = ref(rtdb, `users/${userId}/appearance`);
                onValue(appearanceRef, (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        document.getElementById('fontFamily').value = data.fontFamily || 'Inter, sans-serif';

                        // Handle background image or color
                        document.querySelectorAll('.color-square').forEach(sq => sq.classList.remove('selected'));
                        if (data.backgroundImage) {
                            backgroundImagePreview.src = data.backgroundImage;
                            backgroundImagePreview.style.display = 'block';
                            document.getElementById('backgroundImageFileName').textContent = 'File loaded';
                            selectedBackgroundColorInput.value = ''; // Clear selected color
                        } else if (data.backgroundColor) {
                            const selectedSquare = document.querySelector(`.color-square[data-color="${data.backgroundColor}"]`);
                            if (selectedSquare) {
                                selectedSquare.classList.add('selected');
                            }
                            selectedBackgroundColorInput.value = data.backgroundColor;
                            backgroundImagePreview.src = '';
                            backgroundImagePreview.style.display = 'none';
                            document.getElementById('backgroundImageFileName').textContent = 'No file chosen';
                        } else {
                             // Default to first color if neither is set
                            const defaultColor = subtleColors[0];
                            document.querySelector(`.color-square[data-color="${defaultColor}"]`).classList.add('selected');
                            selectedBackgroundColorInput.value = defaultColor;
                            backgroundImagePreview.src = '';
                            backgroundImagePreview.style.display = 'none';
                            document.getElementById('backgroundImageFileName').textContent = 'No file chosen';
                        }


                        if (data.heroImage) {
                            heroImagePreview.src = data.heroImage;
                            heroImagePreview.style.display = 'block';
                            document.getElementById('heroImageFileName').textContent = 'File loaded';
                        } else {
                            heroImagePreview.src = '';
                            heroImagePreview.style.display = 'none';
                            document.getElementById('heroImageFileName').textContent = 'No file chosen';
                        }

                        if (data.profileImage) {
                            profileImagePreview.src = data.profileImage;
                            profileImagePreview.style.display = 'block';
                            document.getElementById('profileImageFileName').textContent = 'File loaded';
                        } else {
                            profileImagePreview.src = '';
                            profileImagePreview.style.display = 'none';
                            document.getElementById('profileImageFileName').textContent = 'No file chosen';
                        }
                    } else {
                        // If no data, set default color selection
                        const defaultColor = subtleColors[0];
                        document.querySelector(`.color-square[data-color="${defaultColor}"]`).classList.add('selected');
                        selectedBackgroundColorInput.value = defaultColor;
                    }
                });

                // Load Profile Data for Name and Intro fields
                const profileRef = ref(rtdb, `users/${userId}/profile`);
                onValue(profileRef, (snapshot) => {
                    const profileData = snapshot.val();
                    if (profileData) {
                        profileNameInput.value = profileData.name || '';
                        profileIntroInput.value = profileData.intro || '';
                    } else {
                        profileNameInput.value = '';
                        profileIntroInput.value = '';
                    }
                });
            }

            // Load settings when the module is initialized and auth is ready
            if (isAuthReady && userId) {
                loadAppearanceSettings();
            }
        }

        // --- Contact Tab Logic ---
        /**
         * Initializes the contact information management functionality.
         * Sets up form submission and loads existing contact info.
         */
        function initContactManager() {
            const contactForm = document.getElementById('contactForm');
            const contactLoading = document.getElementById('contactLoading');

            contactForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAuthReady || !userId) {
                    showIslandNotification('User not authenticated. Please wait.', true);
                    return;
                }

                contactLoading.style.display = 'inline-block';
                const formData = new FormData(contactForm);
                const contactData = {
                    email: formData.get('email'),
                    phone: formData.get('phone'),
                    website: formData.get('website'),
                    websiteMessage: formData.get('websiteMessage'), // Added websiteMessage
                    address: formData.get('address')
                };

                try {
                    const contactRef = ref(rtdb, `users/${userId}/contacts`);
                    await set(contactRef, contactData);
                    showIslandNotification('Contact information saved successfully!');
                } catch (error) {
                    console.error("Error saving contact info:", error);
                    showIslandNotification(`Error saving contact info: ${error.message}`, true);
                } finally {
                    contactLoading.style.display = 'none';
                }
            });

            /**
             * Loads contact information from Firebase Realtime Database.
             */
            function loadContactInfo() {
                if (!userId) return;
                const contactRef = ref(rtdb, `users/${userId}/contacts`);
                onValue(contactRef, (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        document.getElementById('contactEmail').value = data.email || '';
                        document.getElementById('contactPhone').value = data.phone || '';
                        document.getElementById('contactWebsite').value = data.website || '';
                        document.getElementById('contactWebsiteMessage').value = data.websiteMessage || ''; // Load websiteMessage
                        document.getElementById('contactAddress').value = data.address || '';
                    }
                });
            }

            // Load settings when the module is initialized and auth is ready
            if (isAuthReady && userId) {
                loadContactInfo();
            }
        }

        // --- Social Media Tab Logic ---
        /**
         * Initializes the social media management functionality.
         * Sets up form submission and loads existing social links.
         */
        function initSocialMediaManager() {
            const socialLinksList = document.getElementById('socialLinksList');
            const noSocialLinksMessage = document.getElementById('noSocialLinks');

            // Define the fixed social media platforms and their icons (already in HTML)
            const socialPlatforms = [
                { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram' },
                { id: 'substack', name: 'Substack', icon: 'fas fa-newspaper' },
                { id: 'tiktok', name: 'TikTok', icon: 'fab fa-tiktok' },
                { id: 'threads', name: 'Threads', icon: 'fab fa-threads' },
                { id: 'reddit', name: 'Reddit', icon: 'fab fa-reddit-alien' },
                { id: 'x', name: 'X (Twitter)', icon: 'fab fa-x-twitter' }
            ];

            /**
             * Attaches event listeners to each social link item.
             * This function is called once after the HTML is rendered.
             */
            function setupSocialLinkListeners() {
                socialPlatforms.forEach(platform => {
                    const listItem = socialLinksList.querySelector(`[data-platform-id="${platform.id}"]`);
                    if (!listItem) return; // Skip if element not found

                    const urlInput = listItem.querySelector('.url-input');
                    const toggleInput = listItem.querySelector('.toggle-switch input');
                    const deleteButton = listItem.querySelector('.delete-btn');

                    // Save on input change (as user types)
                    urlInput.addEventListener('input', async () => {
                        if (!userId) {
                            showIslandNotification('User not authenticated. Please wait.', true);
                            return;
                        }
                        const newUrl = urlInput.value;
                        const newIsActive = toggleInput.checked;
                        const linkRef = ref(rtdb, `users/${userId}/socialMedia/${platform.id}`);

                        if (newUrl.trim() === '' && !newIsActive) {
                            await remove(linkRef); // Remove if both empty and inactive
                            showIslandNotification(`${platform.name} link cleared.`);
                        } else {
                            await set(linkRef, { url: newUrl, isActive: newIsActive });
                            showIslandNotification(`${platform.name} link saved.`);
                        }
                    });

                    // Save on toggle change
                    toggleInput.addEventListener('change', async () => {
                        if (!userId) {
                            showIslandNotification('User not authenticated. Please wait.', true);
                            return;
                        }
                        const newIsActive = toggleInput.checked;
                        const currentUrlForToggle = urlInput.value; // Get current URL from input
                        const linkRef = ref(rtdb, `users/${userId}/socialMedia/${platform.id}`);

                        if (currentUrlForToggle.trim() === '' && !newIsActive) {
                            await remove(linkRef); // Remove if URL is empty and toggle is off
                            showIslandNotification(`${platform.name} link cleared.`);
                        } else {
                            await set(linkRef, { url: currentUrlForToggle, isActive: newIsActive });
                            showIslandNotification(`${platform.name} link ${newIsActive ? 'activated' : 'deactivated'}.`);
                        }
                    });

                    // Handle delete (clears the specific link)
                    deleteButton.addEventListener('click', async () => {
                        if (!userId) {
                            showIslandNotification('User not authenticated. Please wait.', true);
                            return;
                        }
                        // This will remove the data from Firebase, and the onValue listener will re-render
                        const linkRef = ref(rtdb, `users/${userId}/socialMedia/${platform.id}`);
                        await remove(linkRef);
                        showIslandNotification(`${platform.name} link cleared.`);
                        // Manually clear UI after deletion as onValue might be slightly delayed
                        urlInput.value = '';
                        toggleInput.checked = false;
                    });
                });
            }

            /**
             * Loads social media links from Firebase Realtime Database and updates the UI.
             */
            function loadSocialMedia() {
                if (!userId) return;
                const socialMediaRef = ref(rtdb, `users/${userId}/socialMedia`);
                onValue(socialMediaRef, (snapshot) => {
                    const data = snapshot.val();
                    let hasAnyData = false;

                    socialPlatforms.forEach(platform => {
                        const listItem = socialLinksList.querySelector(`[data-platform-id="${platform.id}"]`);
                        if (!listItem) return;

                        const urlInput = listItem.querySelector('.url-input');
                        const toggleInput = listItem.querySelector('.toggle-switch input');

                        const link = data ? data[platform.id] : null;
                        const currentUrl = link ? link.url : '';
                        const isActive = link ? link.isActive : false;

                        urlInput.value = currentUrl;
                        toggleInput.checked = isActive;

                        if (currentUrl.trim() !== '' || isActive) {
                            hasAnyData = true;
                        }
                    });

                    if (!hasAnyData) {
                        noSocialLinksMessage.style.display = 'block';
                    } else {
                        noSocialLinksMessage.style.display = 'none';
                    }
                });
            }

            // Setup listeners once the DOM is ready for the fixed elements
            setupSocialLinkListeners();

            // Load settings when the module is initialized and auth is ready
            if (isAuthReady && userId) {
                loadSocialMedia();
            }
        }

        // --- Activate Card Tab Logic ---
        /**
         * Initializes the NFC card activation functionality.
         * Sets up form submission, live card preview, and loads existing card details.
         * Also handles card order submission and order status display.
         */
        function initCardManager() {
            const cardForm = document.getElementById('cardForm');
            const cardNameInput = document.getElementById('cardName');
            const cardCtaInput = document.getElementById('cardCta');
            const cardLogoInput = document.getElementById('cardLogo');
            const cardLoading = document.getElementById('cardLoading');
            const cardTypeRadios = document.querySelectorAll('input[name="cardTypeRadio"]');

            const previewName = document.getElementById('previewName');
            const previewLogo = document.getElementById('previewLogo');
            const previewQr = document.getElementById('previewQr');
            const cardPreviewElement = document.querySelector('.card-preview'); // Get the main card preview element
            const cardOrderStatusContainer = document.getElementById('cardOrderStatusContainer');
            const activateCardSubmitBtn = document.getElementById('activateCardSubmitBtn');

            // Define card type background images
            const cardBackgrounds = {
                platinum: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/Platinum_texture.jpg/640px-Platinum_texture.jpg',
                black: '', // Black is default background-color
                bamboo: 'https://i.pinimg.com/736x/11/f6/40/11f6400d5b0bc565fc0c1fb69e68a471.jpg'
            };

            // Setup custom file input for card logo
            // Removed setupCustomFileInput for cardLogo to disable file input UI and functionality

            /**
             * Generates a QR code image and updates the preview.
             * Uses an external QR code API for simplicity.
             * @param {string} text - The text to encode in the QR code.
             */
            function generateQRCode(text) {
                const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${encodeURIComponent(text)}`;
                const img = new Image();
                img.src = qrImageUrl;
                img.alt = `QR code for ${text}`;
                img.onload = () => {
                    // Clear previous QR code
                    while (previewQr.firstChild) {
                        previewQr.removeChild(previewQr.firstChild);
                    }
                    previewQr.appendChild(img);
                };
                img.onerror = () => {
                    console.error("Failed to load QR code image.");
                    // Fallback: display text if image fails
                    const textNode = document.createElement('div');
                    textNode.textContent = 'QR Error';
                    textNode.style.fontSize = '0.6rem';
                    textNode.style.textAlign = 'center';
                    while (previewQr.firstChild) {
                        previewQr.removeChild(previewQr.firstChild);
                    }
                    previewQr.appendChild(textNode);
                };
            }

            /**
             * Updates the live card preview based on input values and selected card type.
             */
            function updateCardPreview() {
                previewName.textContent = cardNameInput.value || 'Your Name';
                const ctaValue = cardCtaInput.value || 'No CTA';
                generateQRCode(ctaValue); // Generate QR based on CTA

                const selectedCardType = document.querySelector('input[name="cardTypeRadio"]:checked')?.value || 'black';
                if (cardBackgrounds[selectedCardType]) {
                    cardPreviewElement.style.backgroundImage = `url('${cardBackgrounds[selectedCardType]}')`;
                    cardPreviewElement.style.backgroundColor = 'transparent'; // Ensure background color doesn't show
                } else {
                    cardPreviewElement.style.backgroundImage = 'none';
                    cardPreviewElement.style.backgroundColor = '#000'; // Default black
                }
            }

            // Add event listeners for live preview updates
            cardNameInput.addEventListener('input', updateCardPreview);
            cardCtaInput.addEventListener('input', updateCardPreview);
            cardTypeRadios.forEach(radio => {
                radio.addEventListener('change', updateCardPreview);
            });


            // Remove card logo preview and input change listener to disable logo upload and preview
            // Instead, always show default icon
            previewLogo.innerHTML = `<i class="fas fa-id-card"></i>`;

            /**
             * Loads card details from Firebase Realtime Database.
             */
            function loadCardDetails() {
                if (!userId) return;
                const cardRef = ref(rtdb, `users/${userId}/cards/card01`);
                onValue(cardRef, (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        document.getElementById('cardName').value = data.name || '';
                        document.getElementById('cardCta').value = data.cta || '';

                        // Set selected radio button for card type
                        cardTypeRadios.forEach(radio => {
                            if (radio.value === data.type) {
                                radio.checked = true;
                            } else {
                                radio.checked = false;
                            }
                        });

                        // Update preview
                        previewName.textContent = data.name || 'Your Name';
                        generateQRCode(data.cta || 'No CTA');
                        // Always show default icon, ignore logoUrl
                        previewLogo.innerHTML = `<i class="fas fa-id-card"></i>`;
                    } else {
                        // Default to 'black' if no data exists
                        document.querySelector('input[name="cardTypeRadio"][value="black"]').checked = true;
                    }
                    updateCardPreview(); // Ensure preview is updated even if no data
                });
            }

            /**
             * Loads card order status from "card_orders" folder and updates UI.
             * If order exists, disables form and shows timeline.
             */
            function loadCardOrderStatus() {
                if (!userId) return;
                const orderRef = ref(rtdb, `card_orders/${userId}`);
                onValue(orderRef, (snapshot) => {
                    const orderData = snapshot.val();
                    if (orderData) {
                        // Disable form inputs and submit button
                        cardForm.querySelectorAll('input, button').forEach(el => {
                            if (el !== activateCardSubmitBtn) el.disabled = true;
                        });
                        activateCardSubmitBtn.disabled = true;

                        // Show timeline tracking
                        renderOrderTimeline(orderData.status);
                    } else {
                        // Enable form inputs and submit button
                        cardForm.querySelectorAll('input, button').forEach(el => {
                            el.disabled = false;
                        });
                        activateCardSubmitBtn.disabled = false;

                        // Clear timeline UI
                        cardOrderStatusContainer.innerHTML = '';
                    }
                });
            }

            /**
             * Renders the order timeline with statuses:
             * processing (orange) -> intransit (blue) -> completed (green)
             * @param {string} currentStatus
             */
            function renderOrderTimeline(currentStatus) {
                const statuses = ['processing', 'intransit', 'completed'];
                const statusLabels = {
                    processing: 'Processing',
                    intransit: 'In Transit',
                    completed: 'Completed'
                };
                const statusColors = {
                    processing: '#ea580c', // orange
                    intransit: '#2563eb', // blue
                    completed: '#15803d' // green
                };

                let html = '<div class="order-timeline" aria-label="Card order status timeline">';
                statuses.forEach((status, idx) => {
                    let classes = 'order-step';
                    if (status === currentStatus) {
                        classes += ' active';
                        if (status === 'completed') classes += ' completed';
                        else if (status === 'intransit') classes += ' intransit';
                    } else if (statuses.indexOf(currentStatus) > idx) {
                        // Past steps are considered completed (green)
                        classes += ' active completed';
                    }
                    html += `
                        <div class="${classes}" aria-current="${status === currentStatus ? 'step' : 'false'}" tabindex="0">
                            <div class="circle" style="background-color: ${statusColors[status]}"></div>
                            ${statusLabels[status]}
                        </div>
                    `;
                });
                html += '</div>';
                cardOrderStatusContainer.innerHTML = html;
            }

            cardForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (!isAuthReady || !userId) {
                    showIslandNotification('User not authenticated. Please wait.', true);
                    return;
                }

                cardLoading.style.display = 'inline-block';
                const formData = new FormData(cardForm);
                const selectedCardType = document.querySelector('input[name="cardTypeRadio"]:checked').value;

                const cardData = {
                    type: selectedCardType,
                    name: formData.get('name') || '',
                    cta: formData.get('cta') || '',
                    logoUrl: '' // Always empty, no logo upload allowed
                };

                try {
                    // Removed logo upload code to disable logo upload

                    // Save card details under users/{userId}/cards/card01
                    const cardRef = ref(rtdb, `users/${userId}/cards/card01`);
                    await set(cardRef, cardData);

                    // Also create a card order entry under card_orders/{userId} with status "processing"
                    const orderRef = ref(rtdb, `card_orders/${userId}`);
                    const orderData = {
                        cardDetails: cardData,
                        status: "processing",
                        createdAt: serverTimestamp()
                    };
                    await set(orderRef, orderData);

                    showIslandNotification('NFC Card order placed successfully!');

                    // Disable form and show timeline
                    loadCardOrderStatus();

                } catch (error) {
                    console.error("Error saving card details or placing order:", error);
                    showIslandNotification(`Error saving card details: ${error.message}`, true);
                } finally {
                    cardLoading.style.display = 'none';
                }
            });

            // Load settings when the module is initialized and auth is ready
            if (isAuthReady && userId) {
                loadCardDetails();
                loadCardOrderStatus();
            }
        }

        // --- Overview Tab - Stats Logic ---
        /**
         * Draws a simple line chart on a canvas element.
         * @param {string} canvasId - The ID of the canvas element.
         * @param {Array<Object>} data - An array of data objects, each with 'date' and 'amount' properties.
         * @param {string} label - The label for the chart.
         */
        function drawChart(canvasId, data, label) {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;

            // Ensure canvas dimensions are set for proper rendering
            // Get computed style for width/height to ensure responsiveness
            const computedStyle = getComputedStyle(canvas.parentElement);
            canvas.width = parseInt(computedStyle.width);
            canvas.height = parseInt(computedStyle.height);

            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous drawing

            if (data.length === 0) {
                ctx.fillStyle = '#6b7280';
                ctx.font = '16px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('No data available', canvas.width / 2, canvas.height / 2);
                return;
            }

            // Sort data by date
            data.sort((a, b) => new Date(a.date) - new Date(b.date));

            const dates = data.map(d => {
                const date = new Date(d.date);
                return `${date.getMonth() + 1}/${date.getDate()}`; // MM/DD format
            });
            const amounts = data.map(d => d.amount);

            const maxAmount = Math.max(...amounts);
            const minAmount = Math.min(...amounts);

            const padding = 30;
            const chartWidth = canvas.width - 2 * padding;
            const chartHeight = canvas.height - 2 * padding;

            // Draw X-axis (dates)
            ctx.beginPath();
            ctx.moveTo(padding, canvas.height - padding);
            ctx.lineTo(canvas.width - padding, canvas.height - padding);
            ctx.strokeStyle = '#9ca3af';
            ctx.stroke();

            // Draw Y-axis (amounts)
            ctx.beginPath();
            ctx.moveTo(padding, canvas.height - padding);
            ctx.lineTo(padding, padding);
            ctx.stroke();

            // Draw X-axis labels (dates)
            ctx.fillStyle = '#6b7280';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            const xStep = chartWidth / (dates.length - 1 || 1);
            dates.forEach((date, i) => {
                ctx.fillText(date, padding + i * xStep, canvas.height - padding + 15);
            });

            // Draw Y-axis labels (amounts)
            ctx.textAlign = 'right';
            const yAxisLabelsCount = 5; // Number of labels on Y-axis
            for (let i = 0; i <= yAxisLabelsCount; i++) {
                const yValue = minAmount + (maxAmount - minAmount) * (i / yAxisLabelsCount);
                const yPos = canvas.height - padding - (chartHeight * (i / yAxisLabelsCount));
                ctx.fillText(Math.round(yValue), padding - 5, yPos + 3);
            }

            // Draw data points and lines
            ctx.beginPath();
            ctx.strokeStyle = '#15803d'; /* Green line for chart */
            ctx.lineWidth = 2;
            ctx.fillStyle = '#15803d'; /* Green points for chart */

            amounts.forEach((amount, i) => {
                const x = padding + i * xStep;
                const y = canvas.height - padding - (chartHeight * ((amount - minAmount) / (maxAmount - minAmount || 1)));

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
                ctx.arc(x, y, 3, 0, Math.PI * 2); // Draw point
            });
            ctx.stroke();
        }

        /**
         * Loads statistics data from Firebase Realtime Database and draws charts.
         */
        function loadStats() {
            if (!userId) return;

            // Load Page Visits Stats (general page views)
            const pageVisitsRef = ref(rtdb, `users/${userId}/visits`); // Using 'visits' for general page views
            onValue(pageVisitsRef, (snapshot) => {
                const data = snapshot.val();
                const pageVisitsData = [];
                if (data) {
                    for (const key in data) {
                        pageVisitsData.push({
                            date: data[key].datestamp,
                            amount: data[key].amount
                        });
                    }
                }
                drawChart('pageVisitsChart', pageVisitsData, 'Page Visits');
            });

            // Load Website Visits Stats (clicks on external website link)
            const websiteVisitsRef = ref(rtdb, `users/${userId}/websiteVisits`);
            onValue(websiteVisitsRef, (snapshot) => {
                const data = snapshot.val();
                const websiteVisitsData = [];
                if (data) {
                    for (const key in data) {
                        websiteVisitsData.push({
                            date: data[key].datestamp,
                            amount: data[key].amount
                        });
                    }
                }
                drawChart('websiteVisitsChart', websiteVisitsData, 'Website Clicks');
            });

            // Load Card Taps Stats
            const cardTapsRef = ref(rtdb, `users/${userId}/cardTaps`);
            onValue(cardTapsRef, (snapshot) => {
                const data = snapshot.val();
                const cardTapsData = [];
                if (data) {
                    for (const key in data) {
                        cardTapsData.push({
                            date: data[key].datestamp,
                            amount: data[key].amount
                        });
                    }
                }
                drawChart('cardTapsChart', cardTapsData, 'Card Taps');
            });
        }


        /**
         * Simulates checking username availability.
         * In a real application, this would involve a backend call.
         * @param {string} username - The username to check.
         * @returns {Promise<boolean>} - True if available, false otherwise.
         */
        async function simulateUsernameAvailability(username) {
            // Simulate some delay
            await new Promise(resolve => setTimeout(resolve, 500));
            // Simple simulation: 'testuser' is taken, others are available
            return username.toLowerCase() !== 'testuser';
        }

        /**
         * Loads and updates the content of the Overview tab.
         * This includes profile details, link-in-bio, and stats.
         */
        function loadOverviewContent() {
            if (!userId) {
                console.warn("User ID not available for overview content loading.");
                return;
            }

            const overviewProfileName = document.getElementById('overviewProfileName');
            const overviewProfilePic = document.getElementById('overviewProfilePic');
            const linkInBioDisplay = document.getElementById('linkInBioDisplay');
            const actualLinkInBio = document.getElementById('actualLinkInBio');
            const copyLinkBtn = document.getElementById('copyLinkBtn');
            const setupLinkBtn = document.getElementById('setupLinkBtn');
            const linkInBioMessage = document.getElementById('linkInBioMessage');

            // Load Profile Details
            const profileRef = ref(rtdb, `users/${userId}/profile`);
            onValue(profileRef, (snapshot) => {
                const profileData = snapshot.val();
                const name = profileData?.name || 'Your Name';
                const profilePicUrl = profileData?.profilePicUrl || 'https://placehold.co/80x80/aabbcc/ffffff?text=P';
                const username = profileData?.username || '';

                overviewProfileName.textContent = name;
                overviewProfilePic.src = profilePicUrl;

                currentUsername = username; // Update global currentUsername for modal pre-fill

                if (username) {
                    linkInBioDisplay.style.display = 'flex'; // Show the actual link
                    setupLinkBtn.style.display = 'none'; // Hide the setup button
                    actualLinkInBio.textContent = `anju.pages.dev/r?id=${username}`;
                    linkInBioMessage.textContent = ''; // Clear any previous messages
                    copyLinkBtn.onclick = () => copyTextToClipboard(`anju.pages.dev/r?id=${username}`);
                } else {
                    linkInBioDisplay.style.display = 'none'; // Hide the actual link
                    setupLinkBtn.style.display = 'block'; // Show the setup button
                    linkInBioMessage.textContent = 'Set up your personalized link-in-bio!';
                }
            });

            // Load Stats (already handled by loadStats function)
            loadStats();
            // Load Recent Activity
            loadRecentActivity(currentPage);
        }

        // --- Recent Activity Logic ---
        const recentActivityList = document.getElementById('recentActivityList');
        const noRecentActivityMessage = document.getElementById('noRecentActivity');
        const activityPagination = document.getElementById('activityPagination');
        const prevActivityPageBtn = document.getElementById('prevActivityPage');
        const nextActivityPageBtn = document.getElementById('nextActivityPage');
        const activityPageInfo = document.getElementById('activityPageInfo');

        prevActivityPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderRecentActivity();
            }
        });

        nextActivityPageBtn.addEventListener('click', () => {
            const totalPages = Math.ceil(allActivityData.length / itemsPerPage);
            if (currentPage < totalPages) {
                currentPage++;
                renderRecentActivity();
            }
        });

        /**
         * Renders the current page of recent activity data.
         */
        function renderRecentActivity() {
            recentActivityList.innerHTML = ''; // Clear current list

            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            const paginatedData = allActivityData.slice(startIndex, endIndex);

            if (paginatedData.length === 0) {
                noRecentActivityMessage.style.display = 'block';
                activityPagination.style.display = 'none';
                return;
            } else {
                noRecentActivityMessage.style.display = 'none';
                activityPagination.style.display = 'flex';
            }

            paginatedData.forEach(activity => {
                const item = document.createElement('div');
                item.className = 'activity-item';

                let iconClass = 'fas fa-info-circle'; // Default icon
                let deviceSummary = '';

                if (activity.type === 'websiteVisit') {
                    iconClass = 'fas fa-globe'; // Website icon
                    // Add device details if available
                    if (activity.device) {
                        const userAgent = activity.device.userAgent || 'N/A';
                        const platform = activity.device.platform || 'N/A';
                        const screenResolution = activity.device.screenResolution || 'N/A';

                        // Attempt to parse user agent for browser/OS for a more readable summary
                        let browser = 'Unknown Browser';
                        let os = 'Unknown OS';

                        // Simple User-Agent parsing (can be expanded with a library if needed)
                        if (userAgent.includes('Chrome') && !userAgent.includes('Edge')) {
                            browser = 'Chrome';
                        } else if (userAgent.includes('Firefox')) {
                            browser = 'Firefox';
                        } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
                            browser = 'Safari';
                        } else if (userAgent.includes('Edge')) {
                            browser = 'Edge';
                        } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
                            browser = 'Opera';
                        }

                        if (userAgent.includes('Windows')) {
                            os = 'Windows';
                        } else if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) {
                            os = 'macOS';
                        } else if (userAgent.includes('Android')) {
                            os = 'Android';
                        } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
                            os = 'iOS';
                        } else if (userAgent.includes('Linux')) {
                            os = 'Linux';
                        }

                        deviceSummary = `from ${os} (${browser}) - ${screenResolution}`;
                    }
                } else if (activity.type === 'cardTap') {
                    iconClass = 'fas fa-id-card'; // Card icon
                } else if (activity.type === 'profileUpdate') {
                    iconClass = 'fas fa-user-edit'; // Profile update icon
                }
                // Add more icon mappings as needed for other activity types

                const timestamp = activity.time ? new Date(activity.time).toLocaleString() : 'N/A';
                const ipAddress = activity.ipAddress || 'N/A';

                item.innerHTML = `
                    <div class="activity-icon"><i class="${iconClass}" aria-hidden="true"></i></div>
                    <div class="activity-details">
                        <div class="activity-message">${activity.message}</div>
                        <div class="activity-meta">
                            IP: ${ipAddress} <br>
                            Device: ${deviceSummary}
                        </div>
                        <div class="activity-meta">Time: ${timestamp}</div>
                    </div>
                `;
                recentActivityList.appendChild(item);
            });

            updatePaginationControls();
        }

        /**
         * Updates the state of pagination buttons and info.
         */
        function updatePaginationControls() {
            const totalPages = Math.ceil(allActivityData.length / itemsPerPage);
            activityPageInfo.textContent = `Page ${currentPage} of ${totalPages || 1}`;
            prevActivityPageBtn.disabled = currentPage === 1;
            nextActivityPageBtn.disabled = currentPage === totalPages || totalPages === 0;
        }

        /**
         * Loads recent activity data from Firebase Realtime Database.
         */
        function loadRecentActivity() {
            if (!userId) return;
            const activityRef = ref(rtdb, `users/${userId}/recentActivity`);
            onValue(activityRef, (snapshot) => {
                const data = snapshot.val();
                allActivityData = [];
                if (data) {
                    // Convert object to array and sort by timestamp (descending)
                    allActivityData = Object.keys(data).map(key => ({
                        id: key,
                        ...data[key]
                    })).sort((a, b) => b.time - a.time);
                }
                currentPage = 1; // Reset to first page on data change
                renderRecentActivity();
            });
        }

        // --- Overview Modal Specific Logic ---
        function initOverviewManagerModalLogic() {
            // Modal elements
            const linkSetupModal = document.getElementById('linkSetupModal');
            const closeModalBtn = document.getElementById('closeModalBtn');
            const modalStep1 = document.getElementById('modalStep1');
            const modalStep2 = document.getElementById('modalStep2');
            const usernameInput = document.getElementById('usernameInput');
            const usernameAvailabilityMessage = document.getElementById('usernameAvailabilityMessage');
            const checkUsernameBtn = document.getElementById('checkUsernameBtn');
            const nextStep1Btn = document.getElementById('nextStep1Btn');
            const sendVerificationEmailBtn = document.getElementById('sendVerificationEmailBtn');
            const iHaveVerifiedBtn = document.getElementById('iHaveVerifiedBtn');
            const emailVerificationMessage = document.getElementById('emailVerificationMessage');
            const setupLinkBtn = document.getElementById('setupLinkBtn'); // Get the button from the overview tab

            // Function to open the modal
            setupLinkBtn.addEventListener('click', () => {
                linkSetupModal.classList.add('show');
                // Reset to step 1
                modalStep1.classList.add('active');
                modalStep2.classList.remove('active');
                usernameInput.value = currentUsername; // Pre-fill if exists
                usernameAvailabilityMessage.textContent = '';
                nextStep1Btn.disabled = true;
                emailVerificationMessage.textContent = '';
                usernameInput.focus();
            });

            // Function to close the modal
            closeModalBtn.addEventListener('click', () => {
                linkSetupModal.classList.remove('show');
            });

            // Close modal if clicking outside content (optional, but good UX)
            linkSetupModal.addEventListener('click', (e) => {
                if (e.target === linkSetupModal) {
                    linkSetupModal.classList.remove('show');
                }
            });

            // Step 1: Username Logic
            usernameInput.addEventListener('input', () => {
                usernameAvailabilityMessage.textContent = ''; // Clear message on input
                nextStep1Btn.disabled = true; // Disable next until checked
            });

            checkUsernameBtn.addEventListener('click', async () => {
                const desiredUsername = usernameInput.value.trim();
                if (desiredUsername.length < 3) {
                    usernameAvailabilityMessage.textContent = 'Username must be at least 3 characters.';
                    usernameAvailabilityMessage.style.color = 'red';
                    nextStep1Btn.disabled = true;
                    return;
                }

                // Simulate availability check
                const isAvailable = await simulateUsernameAvailability(desiredUsername);

                if (isAvailable) {
                    usernameAvailabilityMessage.textContent = `Username "${desiredUsername}" is available!`;
                    usernameAvailabilityMessage.style.color = 'green';
                    nextStep1Btn.disabled = false;
                } else {
                    usernameAvailabilityMessage.textContent = `Username "${desiredUsername}" is taken. Try another.`;
                    usernameAvailabilityMessage.style.color = 'red';
                    nextStep1Btn.disabled = true;
                }
            });

            nextStep1Btn.addEventListener('click', async () => {
                const desiredUsername = usernameInput.value.trim();
                if (!userId) {
                    showIslandNotification('User not authenticated. Cannot save username.', true);
                    return;
                }

                try {
                    const profileRef = ref(rtdb, `users/${userId}/profile`);
                    // Only update username, keep other profile data if it exists
                    await update(profileRef, { username: desiredUsername }); // Use update for partial merge
                    showIslandNotification('Username saved successfully!');
                    currentUsername = desiredUsername; // Update global variable

                    const user = auth.currentUser;
                    if (user && user.emailVerified) {
                        currentUserEmailVerified = true;
                        showIslandNotification('Email already verified. Link-in-bio is active!');
                        linkSetupModal.classList.remove('show');
                        loadOverviewContent(); // Refresh overview to show new link
                    } else {
                        currentUserEmailVerified = false;
                        modalStep1.classList.remove('active');
                        modalStep2.classList.add('active');
                    }
                } catch (error) {
                    console.error("Error saving username:", error);
                    showIslandNotification(`Error saving username: ${error.message}`, true);
                }
            });

            // Step 2: Email Verification Logic
            sendVerificationEmailBtn.addEventListener('click', async () => {
                if (!auth.currentUser) {
                    showIslandNotification('No authenticated user to send email to.', true);
                    return;
                }
                try {
                    await sendEmailVerification(auth.currentUser);
                    emailVerificationMessage.textContent = 'Check your email - we sent an account verification link!';
                    emailVerificationMessage.style.color = 'green';
                    showIslandNotification('Verification email sent!');
                } catch (error) {
                    console.error("Error sending verification email:", error);
                    showIslandNotification(`Error sending email: ${error.message}`, true);
                }
            });

            iHaveVerifiedBtn.addEventListener('click', async () => {
                if (!auth.currentUser) {
                    showIslandNotification('No authenticated user.', true);
                    return;
                }
                // Reload user to get latest email verification status
                await auth.currentUser.reload();
                const user = auth.currentUser;
                if (user && user.emailVerified) {
                    currentUserEmailVerified = true;
                    showIslandNotification('Email successfully verified! Your link-in-bio is now active.');
                    linkSetupModal.classList.remove('show');
                    loadOverviewContent(); // Refresh overview to show new link
                } else {
                    showIslandNotification('Email not yet verified. Please check your inbox.', true);
                    emailVerificationMessage.textContent = 'Still not verified. Please try again after verifying your email.';
                    emailVerificationMessage.style.color = 'orange';
                }
            });
        }


        // --- Main Application Logic ---
        document.addEventListener('DOMContentLoaded', async () => {
            // Initialize tab navigation immediately
            initTabNavigation();

            // Initialize Firebase and wait for authentication to be ready
            await initializeFirebase();

            // Once Firebase auth is ready, initialize managers and load initial overview content
            if (isAuthReady && userId) {
                console.log("Firebase auth is ready. Initializing managers and loading initial overview.");
                initAppearanceManager();
                initContactManager();
                initSocialMediaManager();
                initCardManager();
                initOverviewManagerModalLogic(); // Initialize the modal logic for overview
                loadOverviewContent(); // Explicitly load overview content on initial ready state
            } else {
                console.warn("Firebase authentication not fully ready. Data loading might be delayed.");
                // If not authenticated, the "Not logged in" notification is already shown by initializeFirebase
                // and no other managers should be initialized until authenticated.
            }
        });
