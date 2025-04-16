let profileExpanded = false
addEventListener("load", function () {
    profile = document.createElement("div")
    profile.id = "profile"
    profile.innerHTML = `SWITCHjs, made by <i>moonlightfox</i>. [<a class="profileLink" target="_blank" href="https://github.com/JoeCoding3/SWITCHjs"><b>GitHub repo here</b></a>]`
    profileExpand = document.createElement("div")
    profileExpand.id = "profileExpand"
    profileExpand.innerHTML = `<b>i</b>`
    document.body.append(profile, profileExpand)

    profileExpand.onclick = function () {
        profileExpanded = !profileExpanded
        if (profileExpanded) profile.style.display = "block"
        else profile.style.display = "none"
    }
})
