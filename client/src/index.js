import './index.css';

import React from 'react';
import ReactDOM from 'react-dom';
import {Provider} from "react-redux";
import {createStore, applyMiddleware} from 'redux';
import thunkMiddleware from 'redux-thunk'

// import registerServiceWorker from './registerServiceWorker';
import rootReducer from './store';
import {refreshAll} from "./store/data";
import App from './views/App';


const store = createStore(
  rootReducer,
  applyMiddleware(thunkMiddleware)
);


ReactDOM.render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root'),
  () => store.dispatch(refreshAll())
);

// registerServiceWorker();
