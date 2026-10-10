// Every icon the app draws inside native (@expo/ui, Stack.Toolbar) views,
// as one table: an SF Symbol on iOS, a Material Symbols vector on Android.
//
// `Icon.select` is rewritten per platform at build time by @expo/ui's Babel
// plugin, so each platform's bundle only carries its own half.
import { Icon } from '@expo/ui';

export const icons = {
  settings: Icon.select({ ios: 'gearshape', android: import('@expo/material-symbols/settings.xml') }),
  info: Icon.select({ ios: 'info.circle', android: import('@expo/material-symbols/info.xml') }),
  add: Icon.select({ ios: 'plus', android: import('@expo/material-symbols/add.xml') }),
  more: Icon.select({ ios: 'ellipsis.circle', android: import('@expo/material-symbols/more_vert.xml') }),
  refresh: Icon.select({ ios: 'arrow.clockwise', android: import('@expo/material-symbols/refresh.xml') }),
  delete: Icon.select({ ios: 'trash', android: import('@expo/material-symbols/delete.xml') }),
  edit: Icon.select({ ios: 'pencil', android: import('@expo/material-symbols/edit.xml') }),
  close: Icon.select({ ios: 'xmark', android: import('@expo/material-symbols/close.xml') }),
  check: Icon.select({ ios: 'checkmark', android: import('@expo/material-symbols/check.xml') }),
  search: Icon.select({ ios: 'magnifyingglass', android: import('@expo/material-symbols/search.xml') }),
  note: Icon.select({ ios: 'note.text', android: import('@expo/material-symbols/sticky_note_2.xml') }),
  pin: Icon.select({ ios: 'pin', android: import('@expo/material-symbols/keep.xml') }),
  unpin: Icon.select({ ios: 'pin.slash', android: import('@expo/material-symbols/keep_off.xml') }),
  list: Icon.select({ ios: 'list.bullet', android: import('@expo/material-symbols/list.xml') }),
  map: Icon.select({ ios: 'map', android: import('@expo/material-symbols/map.xml') }),
  shuffle: Icon.select({ ios: 'shuffle', android: import('@expo/material-symbols/shuffle.xml') }),
  bike: Icon.select({ ios: 'bicycle', android: import('@expo/material-symbols/directions_bike.xml') }),
  metro: Icon.select({ ios: 'tram.fill', android: import('@expo/material-symbols/directions_subway.xml') }),
  location: Icon.select({ ios: 'location', android: import('@expo/material-symbols/near_me.xml') }),
  chevronRight: Icon.select({ ios: 'chevron.right', android: import('@expo/material-symbols/chevron_right.xml') }),
  chevronLeft: Icon.select({ ios: 'chevron.left', android: import('@expo/material-symbols/chevron_left.xml') }),
  // The back item of an Android header submenu (HeaderActions).
  back: Icon.select({ ios: 'chevron.backward', android: import('@expo/material-symbols/arrow_back.xml') }),
  folder: Icon.select({ ios: 'folder', android: import('@expo/material-symbols/folder.xml') }),
  label: Icon.select({ ios: 'tag', android: import('@expo/material-symbols/label.xml') }),
  markRead: Icon.select({ ios: 'checkmark.circle', android: import('@expo/material-symbols/done_all.xml') }),
  restore: Icon.select({ ios: 'arrow.uturn.backward', android: import('@expo/material-symbols/history.xml') }),
  openExternal: Icon.select({ ios: 'arrow.up.right.square', android: import('@expo/material-symbols/open_in_new.xml') }),
  mail: Icon.select({ ios: 'envelope', android: import('@expo/material-symbols/mail.xml') }),
  web: Icon.select({ ios: 'globe', android: import('@expo/material-symbols/language.xml') }),
  camera: Icon.select({ ios: 'camera', android: import('@expo/material-symbols/photo_camera.xml') }),
  hashtag: Icon.select({ ios: 'number', android: import('@expo/material-symbols/tag.xml') }),
  school: Icon.select({ ios: 'graduationcap', android: import('@expo/material-symbols/school.xml') }),
  dice: Icon.select({ ios: 'dice', android: import('@expo/material-symbols/casino.xml') }),
  trophy: Icon.select({ ios: 'trophy.fill', android: import('@expo/material-symbols/trophy.xml') }),
  moveUp: Icon.select({ ios: 'arrow.up', android: import('@expo/material-symbols/arrow_upward.xml') }),
  moveDown: Icon.select({ ios: 'arrow.down', android: import('@expo/material-symbols/arrow_downward.xml') }),
  event: Icon.select({ ios: 'calendar.badge.plus', android: import('@expo/material-symbols/calendar_add_on.xml') }),
  todo: Icon.select({ ios: 'checklist', android: import('@expo/material-symbols/add_task.xml') }),
  calendar: Icon.select({ ios: 'calendar', android: import('@expo/material-symbols/calendar_month.xml') }),
  circle: Icon.select({ ios: 'circle', android: import('@expo/material-symbols/radio_button_unchecked.xml') }),
  checkCircle: Icon.select({ ios: 'checkmark.circle.fill', android: import('@expo/material-symbols/check_circle.xml') }),
  palette: Icon.select({ ios: 'paintpalette', android: import('@expo/material-symbols/palette.xml') }),
  error: Icon.select({ ios: 'exclamationmark.triangle', android: import('@expo/material-symbols/error.xml') }),
  offline: Icon.select({ ios: 'wifi.slash', android: import('@expo/material-symbols/wifi_off.xml') }),
  rent: Icon.select({ ios: 'bicycle', android: import('@expo/material-symbols/pedal_bike.xml') }),
  dock: Icon.select({ ios: 'parkingsign', android: import('@expo/material-symbols/local_parking.xml') }),
  home: Icon.select({ ios: 'house', android: import('@expo/material-symbols/home.xml') }),
  book: Icon.select({ ios: 'book', android: import('@expo/material-symbols/book.xml') }),
  store: Icon.select({ ios: 'storefront', android: import('@expo/material-symbols/store.xml') }),
  bag: Icon.select({ ios: 'bag', android: import('@expo/material-symbols/shopping_bag.xml') }),
  ticket: Icon.select({ ios: 'ticket', android: import('@expo/material-symbols/confirmation_number.xml') }),
  walk: Icon.select({ ios: 'figure.walk', android: import('@expo/material-symbols/directions_walk.xml') }),
  forkKnife: Icon.select({ ios: 'fork.knife', android: import('@expo/material-symbols/restaurant.xml') }),
  takeout: Icon.select({ ios: 'takeoutbag.and.cup.and.straw', android: import('@expo/material-symbols/fastfood.xml') }),
  newspaper: Icon.select({ ios: 'newspaper', android: import('@expo/material-symbols/newspaper.xml') }),
  help: Icon.select({ ios: 'questionmark.circle', android: import('@expo/material-symbols/help.xml') }),
  favorite: Icon.select({ ios: 'heart', android: import('@expo/material-symbols/favorite.xml') }),
  // The package ships outlined glyphs only; the filled heart was generated with
  // `npx add-material-symbols --fill -o assets/icons favorite`.
  favoriteFilled: Icon.select({ ios: 'heart.fill', android: require('@/assets/icons/favorite_fill.xml') }),
  train: Icon.select({ ios: 'tram', android: import('@expo/material-symbols/train.xml') }),
  otherHouses: Icon.select({ ios: 'house.and.flag', android: import('@expo/material-symbols/other_houses.xml') }),
  // Exposed dropdown menu arrow (Android kit PickerRow).
  dropDown: Icon.select({ ios: 'chevron.up.chevron.down', android: import('@expo/material-symbols/arrow_drop_down.xml') }),
  // MonthCalendar's "jump to today" button.
  today: Icon.select({ ios: 'calendar.circle', android: import('@expo/material-symbols/today.xml') }),
  // 建北特約's area links.
  mapPin: Icon.select({ ios: 'mappin', android: import('@expo/material-symbols/location_on.xml') }),
  // 美食's filter menu; the filled glyph shows (as in Mail) that a filter is on.
  filter: Icon.select({ ios: 'line.3.horizontal.decrease.circle', android: import('@expo/material-symbols/filter_list.xml') }),
  filterActive: Icon.select({ ios: 'line.3.horizontal.decrease.circle.fill', android: import('@expo/material-symbols/filter_list.xml') }),
  // 校網's pin toggle in its pinned state. Android reuses the outlined glyph
  // (the kit tints an active toggle) as only outlined symbols ship.
  pinFilled: Icon.select({ ios: 'pin.fill', android: import('@expo/material-symbols/keep.xml') }),
  share: Icon.select({ ios: 'square.and.arrow.up', android: import('@expo/material-symbols/share.xml') }),
};

export type IconKey = keyof typeof icons;
