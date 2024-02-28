import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createStore } from 'redux';
import rootReducer from '../store';
import { refreshAll } from '../store/data';
import App from './App';

it('renders without crashing', () => {
  const div = document.createElement('div');
  const store = createStore(rootReducer);
  const root = createRoot(div);
  const onRefresh = () => store.dispatch(refreshAll());
  root.render(
    <Provider store={store}>
      <App onRefresh={onRefresh}/>
    </Provider>
  );
});
