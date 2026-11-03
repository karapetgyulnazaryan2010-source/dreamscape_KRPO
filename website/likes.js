document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.like-button').forEach((button) => {
        button.addEventListener('click', () => {
            const heart = button.querySelector('.heart-icon');
            const countEl = button.querySelector('.like-count');
            let count = parseInt(button.dataset.likes, 10) || 0;

            const isLiked = button.classList.toggle('liked');

            if (isLiked) {
                count += 1;
                heart.textContent = '♥';
            } else {
                count -= 1;
                heart.textContent = '♡';
            }

            button.dataset.likes = count;
            countEl.textContent = count;

            // restart the pop animation
            heart.classList.remove('heart-pop');
            void heart.offsetWidth;
            heart.classList.add('heart-pop');
        });
    });
});