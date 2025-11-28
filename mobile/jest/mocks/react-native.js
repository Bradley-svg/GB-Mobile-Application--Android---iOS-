const React = require('react');

const createComponent = (tag) =>
  React.forwardRef((props, ref) => React.createElement(tag, { ...props, ref }, props.children));

const View = createComponent('View');
const Text = createComponent('Text');
const ScrollView = createComponent('ScrollView');
const TextInput = createComponent('TextInput');
const Button = ({ title, onPress, ...rest }) =>
  React.createElement('Button', { onClick: onPress, 'data-title': title, ...rest });
const ActivityIndicator = createComponent('ActivityIndicator');
const TouchableOpacity = createComponent('TouchableOpacity');

const Alert = {
  alert: jest.fn(),
};

const StyleSheet = {
  create: (styles) => styles,
  flatten: (styles) => styles,
};

module.exports = {
  View,
  Text,
  ScrollView,
  TextInput,
  Button,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Alert,
};
