//if user left clicks
document.addEventListener('click', event => {
    var menu = document.getElementById("contextMenu")
    var settingsBox = document.getElementsByClassName("settingsBox")
    var id = event.target.id
    console.log(id)
    if(id != "wardenFolder") {
        if(menu.style.display != 'none') menu.style.display = 'none';
        //set background of settingsBox to 0d0d0d
    } else {
        require('child_process').exec('start "" "'+`${process.env.APPDATA}\\warden\\`+'"');
        if(menu.style.display != 'none') menu.style.display = 'none';
    }
});
  
//make an electron context menu when right clicking <li> without using remote
document.addEventListener('contextmenu', event => {
//define Menu
//check if the element is a side menu item
console.log(event.target.classList)
console.log(event.target.id)
if(event.target.classList.contains("settingsBox")) {
    var settingsBox = document.getElementsByClassName("settingsBox")
    //prevent the default context menu from showing
    console.log("selected")
    var menu = document.getElementById("contextMenu")  
    //get page X and Y
    var e = event;    
    menu.style.display = 'block'; 
    menu.style.left = (e.pageX + 0) + "px"; 
    menu.style.top = e.pageY + "px"; 
    menu.style.zIndex = 9999;
    
    
} else{
    //hide the menu
    var menu = document.getElementById("contextMenu")  
    menu.style.display = 'none';
    
}

})

function showToast(text, color){
    var isShowing = false;
    var x=document.getElementById("toast");
    if(isShowing == false) {
      x.classList.add("show");
      if(color != undefined || color != null) x.style.backgroundColor = color;
      else x.style.backgroundColor = "#42ba96";
      var isShowing = true;
      x.innerHTML=text;
      setTimeout(function(){
        x.classList.remove("show");
        var isShowing = false;
      },3000);
    }
}