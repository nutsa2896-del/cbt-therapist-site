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

            trigger.addEventListener('click', function (e) {
                e.stopPropagation();
                isOpen = !isOpen;

                if (isOpen) {
                    content.style.display = 'block';
                    trigger.classList.add('active');
                } else {
                    content.style.display = 'none';
                    trigger.classList.remove('active');
                }
            });

            content.addEventListener('mouseenter', function () {
                isOpen = true;
                content.style.display = 'block';
                trigger.classList.add('active');
            });

            content.addEventListener('mouseleave', function () {
                isOpen = false;
                content.style.display = 'none';
                trigger.classList.remove('active');
            });

            document.addEventListener('click', function (e) {
                if (!dropdown.contains(e.target)) {
                    isOpen = false;
                    content.style.display = 'none';
                    trigger.classList.remove('active');
                }
            });

            var links = content.querySelectorAll('a');
            links.forEach(function (link) {
                link.addEventListener('click', function () {
                    isOpen = false;
                    content.style.display = 'none';
                    trigger.classList.remove('active');
                });
            });
        });
    });
})();
