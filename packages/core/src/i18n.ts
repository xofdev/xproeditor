/**
 * UI strings for both adapters. Every label, tooltip, placeholder and
 * message the editor renders comes from an `EditorDictionary`, so apps can
 * ship the editor in any language:
 *
 * ```ts
 * <ProEditor locale="fa" />                         // built-in Persian
 * <ProEditor dictionary={{ toolbar: { bold: 'Gras' } }} />  // override pieces
 * ```
 */

import type { BlockType } from './types'

export interface EditorDictionary {
  /** Display name of each block type (slash menu, turn-into menus, context menu). */
  blockTypes: Record<BlockType, string>
  /** One-line description shown under each block in the slash menu. */
  blockDescriptions: Record<BlockType, string>
  slash: {
    groups: { basic: string; lists: string; media: string; advanced: string; ai: string }
    askAI: string
    askAIDescription: string
    emoji: string
    emojiDescription: string
    noResults: string
  }
  placeholders: {
    /** Focused empty paragraph. */
    focused: string
    /** Sole empty paragraph of an empty document. */
    emptyDocument: string
    heading1: string
    heading2: string
    heading3: string
    listItem: string
    toDo: string
    toggle: string
    quote: string
    callout: string
    generic: string
    caption: string
  }
  toolbar: {
    bold: string
    italic: string
    underline: string
    strikethrough: string
    code: string
    link: string
    linkPlaceholder: string
    color: string
    textColor: string
    highlight: string
    customColor: string
    resetTextColor: string
    removeHighlight: string
    clearFormatting: string
    askAI: string
    turnInto: string
    alignLeft: string
    alignCenter: string
    alignRight: string
    justify: string
    decreaseIndent: string
    increaseIndent: string
    autoDirection: string
    leftToRight: string
    rightToLeft: string
    calloutIcon: string
    tableStyle: string
    copy: string
    duplicate: string
    delete: string
  }
  blockMenu: {
    searchActions: string
    defaultColor: string
    turnInto: string
    color: string
    duplicate: string
    copy: string
    cut: string
    delete: string
    insertBelow: string
    askAI: string
    noMatches: string
    addBelow: string
    dragHandle: string
    changeCalloutIcon: string
    changeCalloutColor: string
    toggleToDo: string
    expandToggle: string
    collapseToggle: string
  }
  media: {
    upload: string
    library: string
    link: string
    embed: string
    add: string
    working: string
    addCaption: string
    openLibrary: string
    replace: string
    remove: string
    imageAdd: string
    imageChoose: string
    imageUrlPlaceholder: string
    imageInvalidUrl: string
    videoAdd: string
    videoChoose: string
    videoUrlPlaceholder: string
    videoInvalidUrl: string
    videoEmbedded: string
    audioAdd: string
    audioChoose: string
    audioUrlPlaceholder: string
    audioInvalidUrl: string
    fileAttach: string
    fileChoose: string
    fileDownload: string
    uploadFailed: string
  }
  code: {
    language: string
    placeholder: string
    plainText: string
    wrap: string
    disableWrap: string
    copy: string
    copied: string
    exitHint: string
  }
  table: {
    addRow: string
    addRowBelow: string
    removeRow: string
    addColumn: string
    removeColumn: string
    removeLastColumn: string
    merge: string
    unmerge: string
    mergeSelected: string
    selectHint: string
    headerOn: string
    headerOff: string
    text: string
    cell: string
    table: string
    border: string
    textColor: string
    highlight: string
    resetText: string
    resetHighlight: string
    resetCellBackground: string
    tableBackground: string
    headerBackground: string
    resetTableBackground: string
    resetHeaderBackground: string
    preview: string
    width: string
    style: string
    resetBorder: string
  }
  bookmark: {
    add: string
    title: string
    edit: string
    placeholder: string
    create: string
    update: string
    creating: string
    hint: string
    removeLink: string
    invalidUrl: string
  }
  button: {
    defaultLabel: string
    settings: string
    style: string
    fill: string
    outline: string
    ghost: string
    align: string
    themeDefault: string
    link: string
    openInNewTab: string
    label: string
    color: string
  }
  embed: {
    add: string
    title: string
    edit: string
    placeholder: string
    submit: string
    update: string
    hint: string
    invalidUrl: string
    remove: string
    height: string
    open: string
  }
  toc: {
    title: string
    empty: string
  }
  ai: {
    askAI: string
    close: string
    send: string
    commands: string
    ask: string
    selection: string
    noMatching: string
    writing: string
    thinking: string
    stop: string
    retry: string
    cancel: string
    accept: string
    discard: string
    noResponse: string
    failed: string
    editSelectionPlaceholder: string
    writePlaceholder: string
  }
  emoji: {
    search: string
    recent: string
    noResults: string
    customPlaceholder: string
    set: string
    categories: {
      smileys: string
      nature: string
      food: string
      activities: string
      travel: string
      objects: string
      symbols: string
    }
  }
  renderer: {
    copyLink: string
    linkCopied: string
    copyCode: string
    codeCopied: string
    downloadFile: string
  }
  common: {
    set: string
    remove: string
    cancel: string
    apply: string
    close: string
  }
}

export const EN_DICTIONARY: EditorDictionary = {
  blockTypes: {
    paragraph: 'Text',
    heading_1: 'Heading 1',
    heading_2: 'Heading 2',
    heading_3: 'Heading 3',
    bulleted_list_item: 'Bulleted list',
    numbered_list_item: 'Numbered list',
    to_do: 'To-do',
    toggle: 'Toggle list',
    toggle_heading_1: 'Toggle heading 1',
    toggle_heading_2: 'Toggle heading 2',
    toggle_heading_3: 'Toggle heading 3',
    quote: 'Quote',
    callout: 'Callout',
    code: 'Code',
    divider: 'Divider',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    file: 'File',
    table: 'Table',
    button: 'Button',
    bookmark: 'Web bookmark',
    embed: 'Embed',
    table_of_contents: 'Table of contents',
  },
  blockDescriptions: {
    paragraph: 'Plain paragraph',
    heading_1: 'Large section heading',
    heading_2: 'Medium section heading',
    heading_3: 'Small section heading',
    bulleted_list_item: 'Simple bullet list',
    numbered_list_item: 'Ordered list',
    to_do: 'Checkbox task',
    toggle: 'Collapsible list item',
    toggle_heading_1: 'Large collapsible heading',
    toggle_heading_2: 'Medium collapsible heading',
    toggle_heading_3: 'Small collapsible heading',
    quote: 'Capture a quote',
    callout: 'Highlighted note with emoji or icon',
    code: 'Code block with syntax',
    divider: 'Horizontal line',
    image: 'Upload an image',
    video: 'Upload or embed a video',
    audio: 'Upload or link audio',
    file: 'Attach a downloadable file',
    table: 'Simple table',
    button: 'A clickable link styled as a button',
    bookmark: 'Visual bookmark from a link',
    embed: 'YouTube, Figma, CodePen, Loom, Maps…',
    table_of_contents: 'Linked list of the headings',
  },
  slash: {
    groups: {
      basic: 'Basic blocks',
      lists: 'Lists & tasks',
      media: 'Media',
      advanced: 'Advanced',
      ai: 'AI',
    },
    askAI: 'Ask AI',
    askAIDescription: 'Generate or edit with AI',
    emoji: 'Emoji',
    emojiDescription: 'Insert an emoji',
    noResults: 'No results',
  },
  placeholders: {
    focused: "Type '/' for commands…",
    emptyDocument: 'Start writing, or type / for blocks',
    heading1: 'Heading 1',
    heading2: 'Heading 2',
    heading3: 'Heading 3',
    listItem: 'List item',
    toDo: 'To-do',
    toggle: 'Toggle',
    quote: 'Quote',
    callout: 'Type something…',
    generic: 'Type something…',
    caption: 'Add a caption…',
  },
  toolbar: {
    bold: 'Bold',
    italic: 'Italic',
    underline: 'Underline',
    strikethrough: 'Strikethrough',
    code: 'Inline code',
    link: 'Link',
    linkPlaceholder: 'Paste or type a link…',
    color: 'Color',
    textColor: 'Text',
    highlight: 'Highlight',
    customColor: 'Custom',
    resetTextColor: 'Reset text color',
    removeHighlight: 'Remove highlight',
    clearFormatting: 'Clear formatting',
    askAI: 'Ask AI',
    turnInto: 'Turn into',
    alignLeft: 'Align left',
    alignCenter: 'Align center',
    alignRight: 'Align right',
    justify: 'Justify',
    decreaseIndent: 'Decrease indent',
    increaseIndent: 'Increase indent',
    autoDirection: 'Auto direction',
    leftToRight: 'Left-to-right',
    rightToLeft: 'Right-to-left',
    calloutIcon: 'Callout icon',
    tableStyle: 'Table style',
    copy: 'Copy',
    duplicate: 'Duplicate',
    delete: 'Delete',
  },
  blockMenu: {
    searchActions: 'Search actions…',
    defaultColor: 'Default',
    turnInto: 'Turn into',
    color: 'Color',
    duplicate: 'Duplicate',
    copy: 'Copy',
    cut: 'Cut',
    delete: 'Delete',
    insertBelow: 'Insert below',
    askAI: 'Ask AI',
    noMatches: 'No matching actions',
    addBelow: 'Add block below',
    dragHandle: 'Drag to move, click for menu',
    changeCalloutIcon: 'Change callout icon',
    changeCalloutColor: 'Change callout color',
    toggleToDo: 'Toggle to-do',
    expandToggle: 'Expand toggle',
    collapseToggle: 'Collapse toggle',
  },
  media: {
    upload: 'Upload',
    library: 'Library',
    link: 'Link',
    embed: 'Embed',
    add: 'Add',
    working: 'Working…',
    addCaption: 'Add a caption…',
    openLibrary: 'Open media library',
    replace: 'Replace',
    remove: 'Remove',
    imageAdd: 'Add an image',
    imageChoose: 'Choose image',
    imageUrlPlaceholder: 'Paste an image URL',
    imageInvalidUrl: 'Enter a valid image URL',
    videoAdd: 'Add a video',
    videoChoose: 'Choose video file',
    videoUrlPlaceholder: 'YouTube or Vimeo URL',
    videoInvalidUrl: 'Enter a valid YouTube or Vimeo URL',
    videoEmbedded: 'Embedded video',
    audioAdd: 'Add audio',
    audioChoose: 'Choose audio file',
    audioUrlPlaceholder: 'Audio file URL (.mp3, .ogg, …)',
    audioInvalidUrl: 'Enter a valid audio file URL',
    fileAttach: 'Attach a file',
    fileChoose: 'Choose file',
    fileDownload: 'Download',
    uploadFailed: 'Upload failed',
  },
  code: {
    language: 'Language',
    placeholder: 'Write code…',
    plainText: 'Plain text',
    wrap: 'Wrap lines',
    disableWrap: 'Disable wrap',
    copy: 'Copy code',
    copied: 'Copied',
    exitHint: 'Ctrl+↵ exit',
  },
  table: {
    addRow: 'Add row',
    addRowBelow: 'Add row below',
    removeRow: 'Remove row',
    addColumn: 'Add column',
    removeColumn: 'Remove selected column',
    removeLastColumn: 'Remove last column',
    merge: 'Merge',
    unmerge: 'Unmerge',
    mergeSelected: 'Merge selected cells',
    selectHint: 'Drag or Shift+click to select 2+ cells',
    headerOn: 'Header: on',
    headerOff: 'Header: off',
    text: 'Text',
    cell: 'Cell',
    table: 'Table',
    border: 'Border',
    textColor: 'Text color',
    highlight: 'Highlight',
    resetText: 'Reset text',
    resetHighlight: 'Reset highlight',
    resetCellBackground: 'Reset cell background',
    tableBackground: 'Table background',
    headerBackground: 'Header background',
    resetTableBackground: 'Reset table background',
    resetHeaderBackground: 'Reset header background',
    preview: 'Preview',
    width: 'Width',
    style: 'Style',
    resetBorder: 'Reset border',
  },
  bookmark: {
    add: 'Add a web bookmark',
    title: 'Bookmark',
    edit: 'Edit bookmark',
    placeholder: 'Paste in https://…',
    create: 'Create bookmark',
    update: 'Update bookmark',
    creating: 'Creating…',
    hint: 'Create a visual bookmark from a link.',
    removeLink: 'Remove link',
    invalidUrl: 'Enter a valid http(s) URL',
  },
  button: {
    defaultLabel: 'Button',
    settings: 'Button settings',
    style: 'Style',
    fill: 'Fill',
    outline: 'Outline',
    ghost: 'Ghost',
    align: 'Align',
    themeDefault: 'Theme default',
    link: 'Link',
    openInNewTab: 'Open in new tab',
    label: 'Label',
    color: 'Color',
  },
  embed: {
    add: 'Embed a link',
    title: 'Embed',
    edit: 'Edit embed',
    placeholder: 'Paste a YouTube, Figma, CodePen, Loom… link',
    submit: 'Embed link',
    update: 'Update embed',
    hint: 'Works with YouTube, Vimeo, Loom, Figma, CodePen, CodeSandbox, Spotify, SoundCloud and Google Maps.',
    invalidUrl: 'This link can’t be embedded',
    remove: 'Remove embed',
    height: 'Height',
    open: 'Open original',
  },
  toc: {
    title: 'Table of contents',
    empty: 'Add headings to build the table of contents.',
  },
  ai: {
    askAI: 'Ask AI',
    close: 'Close',
    send: 'Send',
    commands: 'AI commands',
    ask: 'Ask',
    selection: 'Selection',
    noMatching: 'No matching commands — press Enter to run your prompt.',
    writing: 'Writing…',
    thinking: 'Thinking…',
    stop: 'Stop',
    retry: 'Retry',
    cancel: 'Cancel',
    accept: 'Accept',
    discard: 'Discard',
    noResponse: 'No response from AI',
    failed: 'AI request failed',
    editSelectionPlaceholder: 'Edit selection with AI…',
    writePlaceholder: 'Ask AI to write…',
  },
  emoji: {
    search: 'Search emoji…',
    recent: 'Recently used',
    noResults: 'No emoji found',
    customPlaceholder: 'Custom emoji or text',
    set: 'Set',
    categories: {
      smileys: 'Smileys & People',
      nature: 'Animals & Nature',
      food: 'Food & Drink',
      activities: 'Activities',
      travel: 'Travel & Places',
      objects: 'Objects',
      symbols: 'Symbols',
    },
  },
  renderer: {
    copyLink: 'Copy link',
    linkCopied: 'Copied!',
    copyCode: 'Copy code',
    codeCopied: 'Copied',
    downloadFile: 'Download file',
  },
  common: {
    set: 'Set',
    remove: 'Remove',
    cancel: 'Cancel',
    apply: 'Apply',
    close: 'Close',
  },
}

export const FA_DICTIONARY: EditorDictionary = {
  blockTypes: {
    paragraph: 'متن',
    heading_1: 'سرتیتر ۱',
    heading_2: 'سرتیتر ۲',
    heading_3: 'سرتیتر ۳',
    bulleted_list_item: 'فهرست نقطه‌ای',
    numbered_list_item: 'فهرست شماره‌دار',
    to_do: 'کار (چک‌لیست)',
    toggle: 'فهرست تاشو',
    toggle_heading_1: 'سرتیتر تاشو ۱',
    toggle_heading_2: 'سرتیتر تاشو ۲',
    toggle_heading_3: 'سرتیتر تاشو ۳',
    quote: 'نقل‌قول',
    callout: 'کادر نکته',
    code: 'کد',
    divider: 'خط جداکننده',
    image: 'تصویر',
    video: 'ویدیو',
    audio: 'صدا',
    file: 'فایل',
    table: 'جدول',
    button: 'دکمه',
    bookmark: 'نشانک وب',
    embed: 'جاسازی',
    table_of_contents: 'فهرست مطالب',
  },
  blockDescriptions: {
    paragraph: 'پاراگراف ساده',
    heading_1: 'سرتیتر بزرگ بخش',
    heading_2: 'سرتیتر متوسط بخش',
    heading_3: 'سرتیتر کوچک بخش',
    bulleted_list_item: 'فهرست نقطه‌ای ساده',
    numbered_list_item: 'فهرست مرتب',
    to_do: 'کار با چک‌باکس',
    toggle: 'آیتم فهرست تاشو',
    toggle_heading_1: 'سرتیتر بزرگ تاشو',
    toggle_heading_2: 'سرتیتر متوسط تاشو',
    toggle_heading_3: 'سرتیتر کوچک تاشو',
    quote: 'ثبت یک نقل‌قول',
    callout: 'یادداشت برجسته با ایموجی یا آیکون',
    code: 'بلوک کد با رنگ‌بندی نحوی',
    divider: 'خط افقی',
    image: 'بارگذاری تصویر',
    video: 'بارگذاری یا جاسازی ویدیو',
    audio: 'بارگذاری یا پیوند صدا',
    file: 'پیوست فایل قابل دانلود',
    table: 'جدول ساده',
    button: 'پیوند قابل کلیک به شکل دکمه',
    bookmark: 'نشانک تصویری از یک پیوند',
    embed: 'یوتیوب، فیگما، کدپن، لوم، نقشه…',
    table_of_contents: 'فهرست پیونددار سرتیترها',
  },
  slash: {
    groups: {
      basic: 'بلوک‌های پایه',
      lists: 'فهرست‌ها و کارها',
      media: 'رسانه',
      advanced: 'پیشرفته',
      ai: 'هوش مصنوعی',
    },
    askAI: 'از هوش مصنوعی بپرس',
    askAIDescription: 'تولید یا ویرایش با هوش مصنوعی',
    emoji: 'ایموجی',
    emojiDescription: 'درج ایموجی',
    noResults: 'نتیجه‌ای پیدا نشد',
  },
  placeholders: {
    focused: 'برای دستورها «/» را تایپ کنید…',
    emptyDocument: 'شروع به نوشتن کنید، یا برای بلوک‌ها / را بزنید',
    heading1: 'سرتیتر ۱',
    heading2: 'سرتیتر ۲',
    heading3: 'سرتیتر ۳',
    listItem: 'آیتم فهرست',
    toDo: 'کار',
    toggle: 'تاشو',
    quote: 'نقل‌قول',
    callout: 'چیزی بنویسید…',
    generic: 'چیزی بنویسید…',
    caption: 'افزودن زیرنویس…',
  },
  toolbar: {
    bold: 'پررنگ',
    italic: 'مورب',
    underline: 'زیرخط',
    strikethrough: 'خط‌خورده',
    code: 'کد درون‌خطی',
    link: 'پیوند',
    linkPlaceholder: 'پیوند را بچسبانید یا تایپ کنید…',
    color: 'رنگ',
    textColor: 'متن',
    highlight: 'هایلایت',
    customColor: 'سفارشی',
    resetTextColor: 'بازنشانی رنگ متن',
    removeHighlight: 'حذف هایلایت',
    clearFormatting: 'پاک کردن قالب‌بندی',
    askAI: 'از هوش مصنوعی بپرس',
    turnInto: 'تبدیل به',
    alignLeft: 'چپ‌چین',
    alignCenter: 'وسط‌چین',
    alignRight: 'راست‌چین',
    justify: 'تراز دوطرفه',
    decreaseIndent: 'کاهش تورفتگی',
    increaseIndent: 'افزایش تورفتگی',
    autoDirection: 'جهت خودکار',
    leftToRight: 'چپ به راست',
    rightToLeft: 'راست به چپ',
    calloutIcon: 'آیکون کادر نکته',
    tableStyle: 'سبک جدول',
    copy: 'کپی',
    duplicate: 'تکثیر',
    delete: 'حذف',
  },
  blockMenu: {
    searchActions: 'جستجوی عملیات…',
    defaultColor: 'پیش‌فرض',
    turnInto: 'تبدیل به',
    color: 'رنگ',
    duplicate: 'تکثیر',
    copy: 'کپی',
    cut: 'برش',
    delete: 'حذف',
    insertBelow: 'درج در پایین',
    askAI: 'از هوش مصنوعی بپرس',
    noMatches: 'عملیاتی پیدا نشد',
    addBelow: 'افزودن بلوک در پایین',
    dragHandle: 'برای جابه‌جایی بکشید، برای منو کلیک کنید',
    changeCalloutIcon: 'تغییر آیکون کادر نکته',
    changeCalloutColor: 'تغییر رنگ کادر نکته',
    toggleToDo: 'تغییر وضعیت کار',
    expandToggle: 'باز کردن',
    collapseToggle: 'بستن',
  },
  media: {
    upload: 'بارگذاری',
    library: 'کتابخانه',
    link: 'پیوند',
    embed: 'جاسازی',
    add: 'افزودن',
    working: 'در حال انجام…',
    addCaption: 'افزودن زیرنویس…',
    openLibrary: 'باز کردن کتابخانه رسانه',
    replace: 'جایگزینی',
    remove: 'حذف',
    imageAdd: 'افزودن تصویر',
    imageChoose: 'انتخاب تصویر',
    imageUrlPlaceholder: 'نشانی تصویر را بچسبانید',
    imageInvalidUrl: 'یک نشانی تصویر معتبر وارد کنید',
    videoAdd: 'افزودن ویدیو',
    videoChoose: 'انتخاب فایل ویدیو',
    videoUrlPlaceholder: 'نشانی یوتیوب یا ویمئو',
    videoInvalidUrl: 'یک نشانی معتبر یوتیوب یا ویمئو وارد کنید',
    videoEmbedded: 'ویدیوی جاسازی‌شده',
    audioAdd: 'افزودن صدا',
    audioChoose: 'انتخاب فایل صوتی',
    audioUrlPlaceholder: 'نشانی فایل صوتی (‎.mp3، ‎.ogg، …)',
    audioInvalidUrl: 'یک نشانی فایل صوتی معتبر وارد کنید',
    fileAttach: 'پیوست فایل',
    fileChoose: 'انتخاب فایل',
    fileDownload: 'دانلود',
    uploadFailed: 'بارگذاری ناموفق بود',
  },
  code: {
    language: 'زبان',
    placeholder: 'کد بنویسید…',
    plainText: 'متن ساده',
    wrap: 'شکستن خطوط',
    disableWrap: 'بدون شکستن خط',
    copy: 'کپی کد',
    copied: 'کپی شد',
    exitHint: 'Ctrl+↵ خروج',
  },
  table: {
    addRow: 'افزودن سطر',
    addRowBelow: 'افزودن سطر در پایین',
    removeRow: 'حذف سطر',
    addColumn: 'افزودن ستون',
    removeColumn: 'حذف ستون انتخاب‌شده',
    removeLastColumn: 'حذف آخرین ستون',
    merge: 'ادغام',
    unmerge: 'جدا کردن',
    mergeSelected: 'ادغام خانه‌های انتخاب‌شده',
    selectHint: 'برای انتخاب دو خانه یا بیشتر بکشید یا Shift+کلیک کنید',
    headerOn: 'سرستون: روشن',
    headerOff: 'سرستون: خاموش',
    text: 'متن',
    cell: 'خانه',
    table: 'جدول',
    border: 'حاشیه',
    textColor: 'رنگ متن',
    highlight: 'هایلایت',
    resetText: 'بازنشانی متن',
    resetHighlight: 'بازنشانی هایلایت',
    resetCellBackground: 'بازنشانی پس‌زمینه خانه',
    tableBackground: 'پس‌زمینه جدول',
    headerBackground: 'پس‌زمینه سرستون',
    resetTableBackground: 'بازنشانی پس‌زمینه جدول',
    resetHeaderBackground: 'بازنشانی پس‌زمینه سرستون',
    preview: 'پیش‌نمایش',
    width: 'عرض',
    style: 'سبک',
    resetBorder: 'بازنشانی حاشیه',
  },
  bookmark: {
    add: 'افزودن نشانک وب',
    title: 'نشانک',
    edit: 'ویرایش نشانک',
    placeholder: 'نشانی را بچسبانید https://…',
    create: 'ساخت نشانک',
    update: 'به‌روزرسانی نشانک',
    creating: 'در حال ساخت…',
    hint: 'از یک پیوند، نشانک تصویری بسازید.',
    removeLink: 'حذف پیوند',
    invalidUrl: 'یک نشانی http(s) معتبر وارد کنید',
  },
  button: {
    defaultLabel: 'دکمه',
    settings: 'تنظیمات دکمه',
    style: 'سبک',
    fill: 'توپر',
    outline: 'دورخط',
    ghost: 'شفاف',
    align: 'چینش',
    themeDefault: 'پیش‌فرض قالب',
    link: 'پیوند',
    openInNewTab: 'باز شدن در زبانه جدید',
    label: 'عنوان',
    color: 'رنگ',
  },
  embed: {
    add: 'جاسازی یک پیوند',
    title: 'جاسازی',
    edit: 'ویرایش جاسازی',
    placeholder: 'پیوند یوتیوب، فیگما، کدپن، لوم… را بچسبانید',
    submit: 'جاسازی پیوند',
    update: 'به‌روزرسانی جاسازی',
    hint: 'با یوتیوب، ویمئو، لوم، فیگما، کدپن، کدسندباکس، اسپاتیفای، ساندکلاد و گوگل‌مپ کار می‌کند.',
    invalidUrl: 'این پیوند قابل جاسازی نیست',
    remove: 'حذف جاسازی',
    height: 'ارتفاع',
    open: 'باز کردن نسخه اصلی',
  },
  toc: {
    title: 'فهرست مطالب',
    empty: 'برای ساخت فهرست مطالب، سرتیتر اضافه کنید.',
  },
  ai: {
    askAI: 'از هوش مصنوعی بپرس',
    close: 'بستن',
    send: 'ارسال',
    commands: 'دستورهای هوش مصنوعی',
    ask: 'بپرس',
    selection: 'انتخاب',
    noMatching: 'دستوری پیدا نشد — برای اجرای درخواست Enter بزنید.',
    writing: 'در حال نوشتن…',
    thinking: 'در حال فکر کردن…',
    stop: 'توقف',
    retry: 'تلاش دوباره',
    cancel: 'انصراف',
    accept: 'پذیرفتن',
    discard: 'رد کردن',
    noResponse: 'پاسخی از هوش مصنوعی دریافت نشد',
    failed: 'درخواست هوش مصنوعی ناموفق بود',
    editSelectionPlaceholder: 'ویرایش متن انتخاب‌شده با هوش مصنوعی…',
    writePlaceholder: 'از هوش مصنوعی بخواهید بنویسد…',
  },
  emoji: {
    search: 'جستجوی ایموجی…',
    recent: 'اخیراً استفاده‌شده',
    noResults: 'ایموجی پیدا نشد',
    customPlaceholder: 'ایموجی یا متن دلخواه',
    set: 'ثبت',
    categories: {
      smileys: 'شکلک‌ها و افراد',
      nature: 'حیوانات و طبیعت',
      food: 'غذا و نوشیدنی',
      activities: 'فعالیت‌ها',
      travel: 'سفر و مکان‌ها',
      objects: 'اشیا',
      symbols: 'نمادها',
    },
  },
  renderer: {
    copyLink: 'کپی پیوند',
    linkCopied: 'کپی شد!',
    copyCode: 'کپی کد',
    codeCopied: 'کپی شد',
    downloadFile: 'دانلود فایل',
  },
  common: {
    set: 'ثبت',
    remove: 'حذف',
    cancel: 'انصراف',
    apply: 'اعمال',
    close: 'بستن',
  },
}

/** Built-in locales. Pass any other language through `dictionary`. */
export const EDITOR_LOCALES = {
  en: EN_DICTIONARY,
  fa: FA_DICTIONARY,
} as const

export type EditorLocale = keyof typeof EDITOR_LOCALES

/** Recursively optional, for partial dictionary overrides. */
export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K]
}

export type EditorDictionaryOverrides = DeepPartial<EditorDictionary>

function mergeDeep<T>(base: T, patch: unknown): T {
  if (!patch || typeof patch !== 'object') {
    return base
  }

  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }

  for (const [key, value] of Object.entries(patch as Record<string, unknown>)) {
    if (value === undefined) {
      continue
    }

    const current = out[key]

    out[key] = current && typeof current === 'object' && value && typeof value === 'object'
      ? mergeDeep(current, value)
      : value
  }

  return out as T
}

/**
 * Resolve the dictionary for a locale plus overrides. Unknown locales fall
 * back to English; missing keys in overrides fall back to the locale.
 */
export function resolveEditorDictionary(
  locale: string | undefined = 'en',
  overrides?: EditorDictionaryOverrides,
): EditorDictionary {
  const base = (EDITOR_LOCALES as Record<string, EditorDictionary>)[locale] ?? EN_DICTIONARY

  return overrides ? mergeDeep(base, overrides) : base
}

/** Text direction a locale is usually written in. */
export function localeDirection(locale: string | undefined): 'ltr' | 'rtl' {
  return /^(ar|fa|he|ur|ps|ckb|sd|yi|dv)(-|$)/i.test(locale ?? '') ? 'rtl' : 'ltr'
}
