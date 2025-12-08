const React = require('react');

const createComponent = (tag) =>
  React.forwardRef((props, ref) => React.createElement(tag, { ...props, ref }, props.children));

const View = createComponent('View');
const Text = createComponent('Text');
const ScrollView = createComponent('ScrollView');
const TextInput = createComponent('TextInput');
const SafeAreaView = createComponent('SafeAreaView');
const Image = createComponent('Image');
const FlatList = ({ data = [], renderItem, ListEmptyComponent, ...rest }) => {
  const items = Array.isArray(data) ? data : [];
  const children = [];

  if (renderItem) {
    items.forEach((item, index) => {
      children.push(
        React.createElement(
          React.Fragment,
          { key: item?.id ?? index },
          renderItem({ item, index })
        )
      );
    });
  }

  if (items.length === 0 && ListEmptyComponent) {
    if (React.isValidElement(ListEmptyComponent)) {
      children.push(React.cloneElement(ListEmptyComponent, { key: 'empty' }));
    } else {
      const Empty = ListEmptyComponent;
      children.push(React.createElement(Empty, { key: 'empty' }));
    }
  }

  return React.createElement('FlatList', rest, children);
};
const Button = ({ title, onPress, ...rest }) =>
  React.createElement('Button', { onClick: onPress, 'data-title': title, ...rest });
const ActivityIndicator = createComponent('ActivityIndicator');
const TouchableOpacity = createComponent('TouchableOpacity');
const Switch = createComponent('Switch');
const StatusBar = createComponent('StatusBar');
const Platform = {
  OS: 'ios',
  select: (spec) => ('ios' in spec ? spec.ios : spec.default),
};

const Alert = {
  alert: jest.fn(),
};

const Linking = {
  openURL: jest.fn(),
  canOpenURL: jest.fn(async () => true),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
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
  SafeAreaView,
  Image,
  FlatList,
  Button,
  ActivityIndicator,
  TouchableOpacity,
  Switch,
  StatusBar,
  Platform,
  StyleSheet,
  Alert,
  Linking,
};
