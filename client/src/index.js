import './index.css';

import React from 'react';
import {createRoot} from 'react-dom/client';
import {Provider} from "react-redux";
import {createStore, applyMiddleware} from 'redux';
import {thunk} from 'redux-thunk';

// import registerServiceWorker from './registerServiceWorker';
import rootReducer from './store';
import {refreshAll} from "./store/data";
import App from './views/App';


const store = createStore(
  rootReducer,
  applyMiddleware(thunk)
);

const container = document.getElementById('root');
const root = createRoot(container);
const onRefresh = () => store.dispatch(refreshAll());
root.render(
  <Provider store={store}>
    <App onRefresh={onRefresh}/>
  </Provider>
)

// registerServiceWorker();
