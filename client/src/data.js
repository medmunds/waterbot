
const reportUrl = 'https://us-central1-molten-turbine-171801.cloudfunctions.net/report';
const deviceId = '31001a001047343438323536'; // live waterbot


export function fetchReport(type='daily') {
  return fetch(`${reportUrl}?type=${encodeURIComponent(type)}&device_id=${encodeURIComponent(deviceId)}`)
    .then(response => response.json())
    .then(({data}) => data);
}
