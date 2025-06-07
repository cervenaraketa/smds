







        document.addEventListener('DOMContentLoaded', function() {
            const navLinks = document.querySelectorAll('.nav-links a[data-section]');
            const sections = document.querySelectorAll('section');
            const mainContent = document.querySelector('.main-content');
            
            // Navigation click handlers
            navLinks.forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    const sectionIndex = parseInt(this.getAttribute('data-section'));
                    if (sectionIndex >= 0 && sectionIndex < sections.length) {
                        sections[sectionIndex].scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'start'
                        });
                    }
                });
            });
            
            // Horizontal scroll behavior
            let isScrolling = false;
            mainContent.addEventListener('scroll', function() {
                isScrolling = true;
            });
            
            // Update active nav link based on scroll position
            function updateActiveNav() {
                if (isScrolling) return;
                
                const scrollPosition = mainContent.scrollLeft;
                const windowWidth = window.innerWidth;
                
                sections.forEach((section, index) => {
                    const sectionLeft = section.offsetLeft;
                    const sectionRight = sectionLeft + section.offsetWidth;
                    
                    if (scrollPosition >= sectionLeft - windowWidth * 0.5 && 
                        scrollPosition < sectionRight - windowWidth * 0.5) {
                        navLinks.forEach(link => {
                            link.classList.remove('active');
                            if (parseInt(link.getAttribute('data-section')) === index) {
                                link.classList.add('active');
                            }
                        });
                    }
                });
            }
            
            // Throttle scroll events
            setInterval(() => {
                if (isScrolling) {
                    updateActiveNav();
                    isScrolling = false;
                }
            }, 100);
            
            // Initial active nav setup
            updateActiveNav();
        });
    


