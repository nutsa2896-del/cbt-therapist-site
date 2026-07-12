// FAQ accordion functionality
document.querySelectorAll('.faq-toggle').forEach(button => {
    button.addEventListener('click', () => {
        const currentBlock = button.parentElement;
        const isCurrentlyActive = currentBlock.classList.contains('active');
        const isExpanded = button.getAttribute('aria-expanded') === 'true';
        
        // Close all other blocks
        document.querySelectorAll('.faq-block').forEach(block => {
            block.classList.remove('active');
            block.querySelector('.faq-toggle').setAttribute('aria-expanded', 'false');
        });
        
        // Toggle current block if not already active
        if (!isCurrentlyActive) {
            currentBlock.classList.add('active');
            button.setAttribute('aria-expanded', 'true');
        }
    });
});
