var xmlhttp; // ActiveX Object
var apodDomain = "http://apod.nasa.gov";
var apodURL = "http://apod.nasa.gov/apod/";
var titleRegex = new RegExp ("<title>(.*)", "i");
var imgRegex = new RegExp ("(?:src=\")(image\/.*)(?:\")", "i");
var timeoutID = 0;
var numFailedReq = 0; // number of consecutive failed requests
var backgroundImage = "url(images/background_frame.png)";
var refreshImage = "images/arrow_refresh_small.png";
var errorImage = "images/error.png";

function main()
{
	background.src=backgroundImage;
	background.blur(50);
	var txtGlow = background.addTextObject("Picture Puzzle", "Segoe UI", 14, "Black", 20, 50);
	txtGlow.addGlow("white", 2, 55);
	txtGlow.addShadow ("white", 2, 35, 1, 1);
	
	var txtGlow = background.addTextObject("Picture Puzzle", "Segoe UI", 14, "Black", 20, 70);
	txtGlow.addGlow("white", 1, 75);
	//txtGlow.addShadow ("yellow", 1, 35, 1, 1);
	
	//oText = document.getElementById("content").addTextObject("", "Segoe UI", 12, "black", 0, 0);
	//oText.value = "Hello, World!"
}


function toggleFlyout () 
{
	System.Gadget.Flyout.Show ^= true;
}


/**Send an XML HTTP request to the APOD website
 * and schedule a reconnect
 */
function getAPOD()
{
	// set picture to refresh
	setPicture (refreshImage);
	picture.title = "Loading APOD…";
	
	// load this every single time to avoid ridiculously 
	// esoteric errors:
	xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
	xmlhttp.onreadystatechange=checkResponse;
	xmlhttp.open ("GET", apodURL, true);
	xmlhttp.send (null); // important: don't remove this.
	
	handleReconnect();
} // end of getAPOD


/**Check the http status, and send it to page parser if OK.
 * An error is shown if there's a problem.
 */
function checkResponse()
{
	if (xmlhttp.readyState == 4)
	if (xmlhttp.status==200)
	{
		parseResponse();
	}
	else
	{
		showError(
			"<p><b>Error accessing APoD website</b></p>"+
			"<p>Status Returned: "+
			xmlhttp.status +
			" "+
			xmlhttp.statusText+
			"</p>"
		);
	}
} // end of checkResponse()


/**Parse the page and extract the relavant details
 * (image link, title, explanation)
 */
function parseResponse ()
{
	var img = imgRegex.exec(xmlhttp.responseText);
	if (img) {
		setPicture (apodURL.concat (img[1]));
		picture.title = parseTitle();
		
		// set explanation:
		// Explanations begin after the image, and preceded by a <center> tag.
		var explnIndex = xmlhttp.responseText.indexOf("<center>", img.lastIndex);
		if (explnIndex >= 0) 
		{
			explanation.innerHTML =  xmlhttp.responseText.substr (explnIndex);
			correctLocalHrefs();
		} else 
		{
			explanation.innerHTML = "<p><b>Error parsing APoD Explanation</b></p>";
		}
	} else {
		showError ("<p><b>Error parsing APoD website</b></p>");
	}
} // end of parseResponse


/**Opens the link specified and sets the picture. The image is resized
 * to fit the frame, but the aspect ratio is retained.
 * @param URL of the picture to be displayed.
 */
function setPicture (link) 
{
	// load photo in a temporary object.
	// This is so that the original dimensions are not lost (which will
	// inevitably happen if it is loaded into picture.src directly.)
	var image = new Image();
	
	// declare event handlers:
	image.onerror = function() {
		showError ("<p><a href="+link+">Image</a> could not be loaded.</p>");
	};
	image.onabort = function() {
		showError ("<p><a href="+link+">Image</a> loading aborted.</p>");
	};
	image.onload = function () {
		resizePicture (image); // correct picture's attributes first.
		picture.src = link; // load into picture now
		
		// PICTURE LOADED!
		// reset failure count and schedule a normal reconnect
		numFailedReq = 0;
		handleReconnect();
	};
	
	// finally, download photo into image:
	image.src = link;
} // end of setPicture


/**Change attributes of picture so that the image can be
 * displayed correctly. The width and height are calculated
 * so that the aspect ratio isn't messed up, and the image
 * is displayed on the center of the frame.
 * @param image: an Image object that holds the original (unaltered) photo
 */
function resizePicture (image) 
{
	var picH = image.height,
		picW = image.width,
		maxW = 320,
		maxH = 240,
		newH = image.height,
		newW = image.width, 
		newTop = 0, 
		newLeft = 0;
	
	// If image is larger than frame, calculate the largest
	// possible size possible while keeping the ratio intact.
	if (picW > picH) {
		if (picW > maxW) {
			newW = maxW;
			newH = Math.ceil (picH*maxW/picW);
		}
	} else {
		if (picH > maxH) {
			newH = maxH;
			newW = Math.ceil (picW*maxH/picH);
		}
	}
	
	// Center the photo:
	newTop = Math.floor ((maxH-newH)/2);
	newLeft = Math.floor ((maxW-newW)/2);
	
	// Change the style:
	with (picture.style) 
		height=newH, 
		width=newW, 
		marginTop=newTop, 
		marginLeft=newLeft;
} // end of resizePicture


function parseTitle () 
{
	var title = titleRegex.exec(xmlhttp.responseText);
	if (title) return title[1];
	else return "";
}


/**Change all non-fully-specified hyperlinks 
 * (e.g. "/apod.rss" instead of "http://apod.nasa.gov/apod.rss")
 * to point to their correct location.
 * (This might not work correctly: unlike normal browsers,
 * local links in a gadget are specified using the x-gadget: protocol
 * which seemingly doesn't differenciate between "/apod.rss" and "apod.rss".
 */
function correctLocalHrefs ()
{
	var protocol = "x-gadget://";
	var curDir = location.pathname.substring (0,location.pathname.lastIndexOf("/"));
	var apodDir = apodURL.substring (0,apodURL.lastIndexOf("/"));
	
	// get all anchors
	var anchors = document.getElementsByTagName("a");
	for (i=0; i<anchors.length; i++)
	{
		// test only for hrefs that begin with specified protocol:
		if (anchors[i].href.indexOf(protocol) < 0) continue;
		
		if (anchors[i].href.indexOf(curDir) < 0) 
		{
			 // target pathname is specified using root ("/apod.rss")
			 // ("file:///C:/apod.rss" -> "/apod.rss" -> "http://apod.nasa.gov/apod.rss")
			var root = anchors[i].href.indexOf("/", protocol.length+1); // "file:///C:"
			anchors[i].href = apodDomain + anchors[i].href.substr (root);
		}
		else 
		{
			// target is in the current directory or its children
			var subDir = anchors[i].href.substr (protocol.length+curDir.length)
			anchors[i].href = apodDir + subDir;
		}
	}
} // end of correctLocalHrefs


/**Display an error message on the Flyout window, show the error icon,
 * increment the number of failed requests so far and attempt a reconnect
 */
function showError (html)
{
	setPicture (errorImage);
	picture.title = "Error getting Astronomy Picture of the Day. (Click to view details.)";
	explanation.innerHTML = html;
	numFailedReq++;
	handleReconnect();
} // end of showError


function handleReconnect ()
{
	clearTimeout (timeoutID);
	if (numFailedReq < 1) 
	{
		// everything's working fine. reconnect after 12hrs:
		timeoutID = setTimeout ("getAPOD()", 43200000);
	} 
	else if (numFailedReq < 2) 
	{ 
		timeoutID = setTimeout ("getAPOD()", 60000); // try after 1 min
	} 
	else if (numFailedReq < 5) 
	{ 
		timeoutID = setTimeout ("getAPOD()", 300000); // try after 5 mins
	}
	else 
	{
		timeoutID = setTimeout ("getAPOD()", 3600000); // try after an hour
	}
} // end of handleReconnect
