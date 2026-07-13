'use strict';

(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var toggles = document.querySelectorAll('.faq-toggle');

        if (!toggles.length) return;

        toggles.forEach(function (button) {
            button.addEventListener('click', function () {
                var currentBlock = button.parentElement;
                if (!currentBlock) return;

                var isCurrentlyActive = currentBlock.classList.contains('active');

                // Close all other blocks
                document.querySelectorAll('.faq-block').forEach(function (block) {
                    block.classList.remove('active');
                    var toggle = block.querySelector('.faq-toggle');
                    if (toggle) {
                        toggle.setAttribute('aria-expanded', 'false');
                    }
                });

                // Toggle current block if not already active
                if (!isCurrentlyActive) {
                    currentBlock.classList.add('active');
                    button.setAttribute('aria-expanded', 'true');
                }
            });
        });
    });
})();
