


function parseJsonLines(text) {
  const lines = text.trim().split('\n');
  return JSON.parse(`[${lines.join(',')}]`);
}


export function fetchJsonLines(url) {
  return fetch(url)
    .then(response => response.text())
    .then(parseJsonLines);
}
