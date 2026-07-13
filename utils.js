'use strict';

(function () {
    function setActiveNavLink() {
        var currentFile = window.location.pathname.split('/').pop() || 'index.html';
        var navLinks = document.querySelectorAll('.nav-link');

        if (!navLinks.length) return;

        navLinks.forEach(function (link) {
            var href = link.getAttribute('href');
            if (href === currentFile || (currentFile === '' && href === 'index.html')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', setActiveNavLink);
})();
