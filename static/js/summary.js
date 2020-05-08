const staticMapZoomLevel = 2;
const mapParentElement = 'map-display';
const selectedTabButtonClassName = 'is-dark';
const hiddenTabClassName = 'is-hidden';

const mapRefs = [];
let mapsSharedInfoWindow = null;
let campaignSelectElement = null;

let tabButtonsParent = null;
let tabsParent = null;

/**
 * Callback for Google Maps deferred load that initializes the map
 */
function initializeMaps() {
  const targetEmail = getURLParam('[e]');
  if (targetEmail) {
    console.log('Target E-mail: ', targetEmail);
  } else {
    window.location.href = '/';
  }

  const mapParents = document.getElementsByClassName(mapParentElement);
  campaignSelectElement = document.getElementById('campaignSelection');
  tabButtonsParent = document.getElementById('tab-buttons');
  tabsParent = document.getElementById('tabs-parent');

  if (mapParents != []) {
    for (let i = 0; i < mapParents.length; i++) {
      const campaign = $(mapParents[i]).attr('id');
      console.log('creating map for ', campaign);
      mapRefs.push(new google.maps.Map(mapParents[i], {
        streetViewControl: false,
        mapTypeControl: false,
      }));
      const mapRef = mapRefs[i];
      mapsSharedInfoWindow = new google.maps.InfoWindow();

      $(document).ready(function() {
        $.get('/viewData', {email: targetEmail, campaign: campaign},
            function(data, status) {
              displayClusteredData(data.locations, mapRef);
            });
      });
    }
  }
}

/**
 * Toggles the tab with the given index & updates the tab buttons selected state
 * @param {Number} tabIndex is the index of the tab that needs to be toggled
 */
function toggleTab(tabIndex) {
  if (tabButtonsParent && tabsParent) {
    const tabButtons = tabButtonsParent.children;
    const tabs = tabsParent.children;
    if (tabButtons.length !== tabs.length) {
      console.log('Number of tab buttons and tabs are not equal.');
      return;
    }
    for (let i = 0; i < tabButtons.length; i++) {
      if (i === tabIndex) {
        tabButtons[i].classList.add(selectedTabButtonClassName);
        tabs[i].classList.remove(hiddenTabClassName);
      } else {
        tabButtons[i].classList.remove(selectedTabButtonClassName);
        tabs[i].classList.add(hiddenTabClassName);
      }
    }
  }
}

/**
 * Called from the UI when the campaign is changed for the user
 */
function onCampaignSelectionChanged() {
  if (campaignSelectElement) {
    console.log(campaignSelectElement.value);
  }
}

/**
 * Displays the clustered location data on maps
 * @param {Array} locationData is an array of lat, lng objects
 * [{lat: -31.56, lng: 147.15}]
 * @param {Map} mapRef is a reference to the map
 */
function displayClusteredData(locationData, mapRef) {
  console.log('Loc data: ' + locationData);
  if (locationData.length == 0) {
    const center = new google.maps.LatLng(0, 0);
    mapRef.setCenter(center);
    mapRef.setZoom(staticMapZoomLevel);
    return;
  }

  const bounds = new google.maps.LatLngBounds();

  const markers = locationData.markerData.map(function(location, i) {
    if (location.hasOwnProperty('lat') && !isNaN(location.lat)) {
      const newMarker = new google.maps.Marker({position: location});
      bounds.extend(newMarker.position);
      newMarker['country'] = locationData.country;
      newMarker['facts'] = locationData.facts;
      newMarker['region'] = location.region;
      newMarker['heading'] = location.headingValue;

      newMarker.addListener('click', function() {
        mapsSharedInfoWindow.setContent(constructInfoWindowContent(
            newMarker.country,
            newMarker.region,
            getRandomFact(newMarker.facts),
            location.lat,
            location.lng,
            newMarker.heading));
        mapsSharedInfoWindow.open(mapRef);
        mapsSharedInfoWindow.setPosition(newMarker.getPosition());
      });

      return newMarker;
    }
    bounds.extend(newMarker.position);
    return newMarker;
  });

  const markerCluster = new MarkerClusterer(mapRef, markers,
      {
        imagePath: '/static/imgs/',
        zoomOnClick: false,
      });

  markerCluster.addListener('clusterclick', function(cluster) {
    const currentCluster = cluster.getMarkers();
    console.log(currentCluster);
    if (currentCluster.length > 0) {
      const randomMarkerIndex = Math.floor(
          (Math.random() * currentCluster.length));
      console.log(randomMarkerIndex);
      const randomMarker = currentCluster[randomMarkerIndex];
      const content = constructInfoWindowContent(
          randomMarker.country,
          randomMarker.region,
          getRandomFact(randomMarker.facts),
          randomMarker.getPosition().lat(),
          randomMarker.getPosition().lng(),
          randomMarker.heading);
      mapsSharedInfoWindow.setContent(content);
      mapsSharedInfoWindow.open(mapRef);
      // Pick the first marker position as the position of
      // the info window to avoid floating info windows
      mapsSharedInfoWindow.setPosition(currentCluster[0].getPosition());
    }
  });
  mapRef.fitBounds(bounds);
  mapRef.panToBounds(bounds);
}

/**
 * Constructs and returns info window html string content
 * @param {String} country is the country value
 * @param {String} region is the region value
 * @param {String} randomFact is the randomFact value displayed on info window
 * @param {Number} latitude is the latitude used for street view link
 * @param {Number} longitude is the longitude used for the street view link
 * @param {Number} heading is the heading valued used for street view link
 * @return {String} content string for the info window
 */
function constructInfoWindowContent(country, region, randomFact, latitude,
    longitude, heading) {
  const contentString = '<div style=\'text-align: left;\'>' +
    '<span style=\'font-size: 18px; color: #606060\'><b>' +
    region + ' </b></span>' +
    '<span style=\'font-size: 16px; color: #909090\'><b>(' +
    country + ')</b></span>' +
    '<br><br> <p style=\'max-width: 300px; color: #505050; font-size: 16px\'>' +
    randomFact +
    '</p> <br> <form action=\'https://google.com/maps/@?\' method=\'get\' ' +
    'target=\'_blank\' style=\'text-align: center;\'>' +
    '<input type=\'hidden\' name=\'api\' value=\'1\'></input>' +
    '<input type=\'hidden\' name=\'map_action\' value=\'pano\'></input>' +
    '<input type=\'hidden\' name=\'viewpoint\' value=\''+
    latitude + ',' + longitude + '\'></input>' +
    '<input type=\'hidden\' name=\'heading\' value=\'' +
    heading + '\'></input>' +
    '<button type=\'submit\' class=\'button is-link is-outlined \'>' +
    ' Take Me There ' +
    '</button></form></div>';
  return contentString;
}

/**
 * Get a parameter value from the URL if available
 * @param {String} paramKey name of the parameter to query
 * @return {String} param value if present
 */
function getURLParam(paramKey) {
  const urlString = window.location.href;
  const url = new URL(urlString);
  return url.searchParams.get(paramKey);
}

/**
 * Get a random fact about country
 * @param {Array} factsArray facts string array
 * @return {String} random fact from the given array or no
 * facts available info string
 */
function getRandomFact(factsArray) {
  return factsArray ? getRandomFrom(factsArray) :
    'No facts are available for the country at the moment.';
}

/**
 * Get a random element from array
 * @param {any[]} inputArray input array of any kind
 * @return {any} returns one random element from the array
 */
function getRandomFrom(inputArray) {
  return inputArray[Math.floor((Math.random() * inputArray.length))];
}
