function showText(type) {
    const popup = document.getElementById('popup');
    const title = document.getElementById('popup-title');
    const text = document.getElementById('popup-text');

    if (type === 'achievement') {
        title.innerText = "Achievements";
        text.innerText = "1. Survived this coding class so far.\n2. Built my first live website in Homework 6.\n3. Learned how to navigate GitHub.";
    } else if (type === 'aspiration') {
        title.innerText = "Aspirations";
        text.innerText = "I want to create digital experiences that feel like magic. My goal is to build interactive worlds that people can get lost in.";
    }
    popup.style.display = 'flex';
}

function closePopup() {
    document.getElementById('popup').style.display = 'none';
}