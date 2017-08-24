import {connect} from 'react-redux';
import ErrorMessages from '../components/ErrorMessages';
import {selectErrorMessages} from '../store/data';


function mapStateToProps(state) {
  const errors = selectErrorMessages(state);
  return {
    errors,
  };
}

export default connect(mapStateToProps, {})(ErrorMessages);
