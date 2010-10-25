System.Gadget.Flyout.onShow = showFlyout;
System.Gadget.Flyout.onHide = hideFlyout;

function showFlyout()
{
   content.innerHTML = System.Gadget.document.getElementById("explanation").innerHTML;
}

function hideFlyout()
{
	content.innerHTML = "";
	System.Gadget.Flyout.show = false;
}
