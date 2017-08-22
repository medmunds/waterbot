import {connect} from 'react-redux';
import {IndeterminateProgress} from '../components/Progress';
import {selectPendingNetworkActivity} from '../store/ui';


function mapStateToProps(state) {
  const active = selectPendingNetworkActivity(state);
  return {
    active,
    className: "NetworkIndicator",
  };
}

export default connect(mapStateToProps, {})(IndeterminateProgress);
