// Dropdown Menu Handler - Make Meet Magda clickable and submenu selectable

document.addEventListener('DOMContentLoaded', function() {
    const dropdowns = document.querySelectorAll('.dropdown');

    dropdowns.forEach(dropdown => {
        const trigger = dropdown.querySelector('.dropdown-trigger');
        const content = dropdown.querySelector('.dropdown-content');
        let isOpen = false;

        // Toggle dropdown on trigger click
        trigger.addEventListener('click', function(e) {
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

        // Keep dropdown open when hovering over content
        content.addEventListener('mouseenter', function() {
            isOpen = true;
            content.style.display = 'block';
            trigger.classList.add('active');
        });

        content.addEventListener('mouseleave', function() {
            isOpen = false;
            content.style.display = 'none';
            trigger.classList.remove('active');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            if (!dropdown.contains(e.target)) {
                isOpen = false;
                content.style.display = 'none';
                trigger.classList.remove('active');
            }
        });

        // Allow links in dropdown to be clicked (don't close immediately)
        const links = content.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', function(e) {
                // Allow normal link navigation
                isOpen = false;
                content.style.display = 'none';
                trigger.classList.remove('active');
            });
        });
    });
});
