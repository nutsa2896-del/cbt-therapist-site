'use strict';

(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var dropdowns = document.querySelectorAll('.dropdown');

        if (!dropdowns.length) return;

        dropdowns.forEach(function (dropdown) {
            var trigger = dropdown.querySelector('.dropdown-trigger');
            var content = dropdown.querySelector('.dropdown-content');

            if (!trigger || !content) return;

            var isOpen = false;
            var closeTimeout = null;

            function openDropdown() {
                if (closeTimeout) {
                    clearTimeout(closeTimeout);
                    closeTimeout = null;
                }
                isOpen = true;
                content.style.display = 'block';
                trigger.classList.add('active');
            }

            function closeDropdown() {
                isOpen = false;
                content.style.display = 'none';
                trigger.classList.remove('active');
            }

            function scheduleClose() {
                closeTimeout = setTimeout(function () {
                    closeDropdown();
                }, 150);
            }

            // Toggle on click
            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                if (isOpen) {
                    closeDropdown();
                } else {
                    openDropdown();
                }
            });

            // Keep open when hovering anywhere in the dropdown container
            dropdown.addEventListener('mouseenter', function () {
                openDropdown();
            });

            dropdown.addEventListener('mouseleave', function () {
                scheduleClose();
            });

            // Close when clicking outside
            document.addEventListener('click', function (e) {
                if (!dropdown.contains(e.target)) {
                    closeDropdown();
                }
            });

            // Allow links to navigate normally
            var links = content.querySelectorAll('a');
            links.forEach(function (link) {
                link.addEventListener('click', function () {
                    closeDropdown();
                });
            });
        });
    });
})();
