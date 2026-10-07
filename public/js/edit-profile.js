const profilePhotoInput = document.getElementById('newProfilePhoto');
const profilePhotoPreview = document.getElementById('profilePhotoPreview');
const editProfileForm = document.getElementById('editProfileForm');
const formMessage = document.getElementById('formMessage');

profilePhotoInput.addEventListener('change', () => {
    const file = profilePhotoInput.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = () => {
        profilePhotoPreview.src = reader.result;
    };
    reader.readAsDataURL(file);
});

document.getElementById('cancelEditBtn').addEventListener('click', () => {
    window.location.href = '/profile';
});

editProfileForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const formData = new FormData();
    formData.append('name', document.getElementById('editName').value);
    formData.append('email', document.getElementById('editEmail').value);
    if (profilePhotoInput.files[0]) {
        formData.append('profilePhoto', profilePhotoInput.files[0]);
    }

    fetch('/update-profile', {
        method: 'POST',
        body: formData,
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            window.location.href = '/profile';
        } else {
            formMessage.textContent = data.error || 'Error updating profile. Please try again.';
        }
    })
    .catch(error => {
        console.error('Error updating profile:', error);
        formMessage.textContent = 'Error updating profile.';
    });
});
