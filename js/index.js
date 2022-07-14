/*
  Обозначения:
  0 - Пусто
  1 - Палуба корабля
  2 - Клетка соседняя с кораблем
  3 - Клетка, в которую стреляли
  4 - Попадание в палубу корабля
*/
(function (){
  //Флаг установки обработчиков событий ведения морского боя
  let isLaunchedController = false;
  //Флаг хода компьютера
  let computerShooting = false;


  //Получение элемента DOM дерева по его айди
  const getElement = id => document.getElementById(id);

  //Вычисление координат всех сторон элемента отнрсительно окна браузера
  const getElementCoordinates = element => {
    const coordinates = element.getBoundingClientRect();
    return{
      left:coordinates.left + window.pageXOffset,
      right:coordinates.right + window.pageXOffset,
      top:coordinates.top + window.pageYOffset,
      bottom:coordinates.bottom + window.pageYOffset
    };
  };

  //Получение игрового поля игрока
  const humanField = getElement("humanField");
  //Получение игрового поля компьютера
  const computerField = getElement("computerField");

  //Класс создания игровых полей
  class Field{
    //Размер стороны игровогополя(в px)
    static GAMEFIELD_SIDE = 330;
    //Размер палубы корабля(в px)
    static SHIP_DECK = 33;
    /*
    Объект с данными о кораблях в виде - ключ:значение
    Ключ - тип корабля
    Значение - массив, состоящий из двух элементов:
    Первый - количество кораблей данного типа
    Второй - количество палуб у корабля
    */
    static SHIP_INFO = {
      fourTiered: [1,4],
      threeTiered: [2,3],
      twoTiered: [3,2],  /*возможно правильно doubleTiered назвать корабль, но в переводчике странное
      название у двухъярусного корабля, поэтому оставлю так*/
      singleTiered: [4,1]
    };

    constructor(field){
      //Конструктор получает объект игрового поля в качестве аргумента
      this.field = field;
      //Объект для данных кораблей эскрадры
      this.squadron = {}
      //Двумерный массив для хранения данных о кораблях, выстрелах(попаданиях и промахах) и пустых клетах
      this.matrix = [];
      //Координаты стороны игрового поля относительно document
      let {left, right, top, bottom} = getElementCoordinates(this.field);
      this.Left = left;
      this.Top = top;
      this.Right = right;
      this.Bottom = bottom;

    }

    static createMatrix() {
      return [...Array(10)].map(()=>Array(10).fill(0));
    }

    //MaxValue - максимальное значение, которое мы можем получить
    static getRandom = maxValue => Math.floor(Math.random()*(maxValue+1));

    randomShipLocation(){
      for(let type in Field.SHIP_INFO){
        let amount = Field.SHIP_INFO[type][0] // Получаем количество кораблей данного типа
        let length = Field.SHIP_INFO[type][1] // Получаем количество палуб кораблей данного типа
        // Перебираем каждый корабль
        for (let i = 0; i < amount; i++){
          let settings = this.getDecksCoordinates(length);
          settings.decks = length; // Количество палуб
          settings.shipName = type + String(i + 1); // Имя корабля для идентификации
          //Создаем экземпляр корабля
          const ship = new Ships(this, settings);
          ship.createShip()
        }
      }
    }

    getDecksCoordinates(length){
      /*
      Рандомно полуаем коэффиценты, определяющие расположение и направление корабля
      kx === 0 и ky === 1 - горизонтальное расположение
      kx === 1 и ky === 0 - вертикальное расположение
      */
      let kx = Field.getRandom(1), ky = (kx === 0) ? 1 : 0, x, y;
      //В зависимости от направления генерируем начальные координаты
      if (kx === 0) {
        x = Field.getRandom(9);
        y = Field.getRandom(10 - length);
      }
      else {
        x = Field.getRandom(10 - length);
        y = Field.getRandom(9);
      }
      const ship = {x, y, kx, ky};
      //Проверка правильности расположения палуб корабля
      const check = this.checkShipLocation(ship, length);
      //Если неправильно расположены палубы, то запускаем еще раз функцию
      if (!check) return this.getDecksCoordinates(length);
      return ship;

    }

    cleanGameField() {
      while(this.field.firstChild)
        this.field.removeChild(this.field.firstChild);
      this.squadron = {};
      this.matrix = Field.createMatrix();

    }

    checkShipLocation(ship, length){
      let {x, y, kx, ky, leftX, rightX, upperY, lowerY} = ship;
      /*
      Формируем индексы, ограничивающие двумерный массив по Х
      Если строка нулевая, то проверку начинаем с нулевой строки,
      если не нулевая, то со строки, с индексом на еденицу меньше
      */
      leftX = (x === 0) ? x : x - 1;
      /*
      Если логическое выражение истинно, то корабль расположен вертикально
      и примыкает к нижней границе поля,
      значит индекс конца цикла - координата Х
      */
      if (x + kx * length === 10 && kx === 1) rightX = 10;
      /*
      Если логическое выражение выполняется, то корабль расположен вертикально
      и между концом корабля и нижней границей есть как минимум одна строка,
      то координата этой строки и будет индексом конца цикла
      */
      else if (x + kx * length < 10 && kx === 1) rightX = x + kx * length + 1;
      /*
      Если логическое выражение выполняется, то корабль расположен горизонтально
      вдоль нижней границы поля
      */
      else if (x === 9 && kx === 0) rightX = 10;
      /*
      Если логическое выражение выполняется, то корабль расположен горизонтально
      не на границах игрового поля
      */
      else if (x < 9 && kx === 0) rightX = x + 2;
      /*
      Формируем индексы, ограничивающие двумерный массив по Y
      Принципы аналогичны ограничениям по X
      */
      upperY = (y === 0) ? y : y - 1;
      if (y + ky * length === 10 && ky === 1) lowerY = 10;
      else if (y + ky * length < 10 && ky === 1) lowerY = y + ky * length + 1;
      else if (y === 9 && ky === 0) lowerY = 10;
      else if (y < 9 && ky === 0) lowerY = y + 2;

      if (!rightX || !lowerY) return false

      /*
      Отфильтровываем ячейки получивчегося двумерного массива,
      и если в нем есть уже заполненные 1 ячейки,
      то возвращаем false
      */
      if (this.matrix.slice(leftX, rightX).
        filter(array => array.slice(upperY, lowerY)
          .includes(1)).length > 0)
            return false;
      return true;
      }
  }
///////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

  class Ships {
    constructor(self, {x, y, kx, ky, decks, shipName}){
      //Для кого создается корабль - для человека или компьютера
      this.player = (self === humanGameField) ? humanGameField : computerGameField;
      //На каком поле создается корабль
      this.field = self.field;
      //ID корабля
      this.shipName = shipName;
      //Количество палуб корабля
      this.decks = decks;
      //Координаты X и Y первой палубы и их направление
      this.x = x;
      this.y = y;
      this.kx = kx;
      this.ky = ky;
      //Счетчик попаданий по кораблю
      this.hits = 0;
      //массив с координатами палуб корабля
      this.arrayOfDecks = [];
    }

    createShip(){
      let {player, field, shipName, decks, x, y, kx, ky, hits, arrayOfDecks, k = 0} = this;
      /*
      Координаты корабля записываем в двумерный массив игрового поля
      */
      while(k < decks){
        let xCoordinate = x + k * kx, yCoordinate = y + k * ky;
        //Значение 1 говорит нам о том, что в ячейке находится палуба корабля
        player.matrix[xCoordinate][yCoordinate] = 1;
        //Записываем координаты палубы
        arrayOfDecks.push([xCoordinate, yCoordinate]);
        k++
      }
      //Помещаем информацию о корабле в объект эскадры
      player.squadron[shipName] = {arrayOfDecks, hits, x, y, kx, ky};

      //Если корабль создан на игровом поле игрока, то выводим его на экран
      if (player === humanGameField){
        Ships.showShip(player, shipName, x, y, kx);
        //Когда все корабли сгенерированы(то есть достигли количества 10), то показываем кнопку начала игры
        if (Object.keys(player.squadron).length === 10){
          playButton.hidden = false;
        }
      }
    }

    static showShip(self, shipName, x, y, kx){
      const div = document.createElement('div');
      //Из имени корабля убираем цифры и получаем имя класса
      const className = shipName.slice(0, -1);
      //Имя класса получаем в зависимости от направления корабля
      const direction = (kx === 1) ? 'vertical' : '';
      div.className = `ship ${className} ${direction}`;
      //Задаем позиционирование корабля относительно родительского элемента
      div.style.cssText = `left:${y * Field.SHIP_DECK}px; top:${x * Field.SHIP_DECK}px`;
      self.field.appendChild(div);
    }
  }
///////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

class Controller{
  //Массив для начальных выстрелов компьютера
  static START_POINTS = [
    [[2,0 ], [0, 2], [6, 0], [0, 6]]
  ];
  //Блок с выводом информации по ходу игры
  static INFO_BLOCK = getElement('infoText');

  constructor(){
    this.player = '';
    this.opponent = '';
    this.text = '';
    this.randomHitsCoordinates = [];
    this.startPointsHitsCoordinates = [];
    this.coordinatesAroundHit = [];
    //Временный объект корабля, куда буду заносить информацию
    this.resetTempShip();
  }
  resetTempShip(){
    this.tempShip = {
      hits: 0,
      firstHit: [],
      kx: 0,
      ky: 0
    };
  }

  //Вывод информационных сообщений
  static showInfoText = infoText => {
    Controller.INFO_BLOCK.innerHTML = infoText;
  }

  //Преобразование абсолютных координат в координаты иконок матрицы
  static getIconCoorinates = element => {
    const x = element.style.top.slice(0, -2) / Field.SHIP_DECK;
    const y = element.style.left.slice(0, -2) / Field.SHIP_DECK;
    return [x, y];
  }

  //Удаление ненужных координат из массива
  static removeCoordinateArray = (array, [x,y]) => {
    return array.filter(coordinate => coordinate[0] != x || coordinate[1] != y)
  }

  init(){
    //Рандомно выбираем игрока и его противника
    const random = Field.getRandom(1);
    this.player = (random === 0) ? humanGameField : computerGameField;
    this.opponent = (this.player === humanGameField) ? computerGameField : humanGameField;

    //Генерируем координаты выстрелов компьютера
    this.setCoordinatesShot();

    //Обработчик хода игрока
    if (!isLaunchedController){
      //Выстрел игрока
      computerField.addEventListener('click', this.makeShot.bind(this));
      //Установка маркера на пустую клетку
      computerField.addEventListener('contextmenu', this.setUselessCell.bind(this));
      isLaunchedController = true;
    }

    if (this.player === humanGameField) {
      computerShooting = false;
      this.text = `${sessionStorage.playerNickname} shooting first`;
    } else {
      //Выстрел компьютера
      computerShooting = true;
      this.text = `Computer's shooting first`;
      setTimeout(() => this.makeShot(), 1500);
    }
    Controller.showInfoText(this.text);
  }

  setCoordinatesShot(){
    //Координаты каждоый клетки поля
    for (let i = 0; i < 10; i++)
      for (let j = 0; j < 10; j++)
        this.randomHitsCoordinates.push([i, j]);

    //Перемешиваем массив с координатами
    this.randomHitsCoordinates.sort((a, b) => Math.random() - 0.5);

    let x, y;

    for (let array of Controller.START_POINTS[0]){
      x = array[0]; y = array[1];
      while(x <= 9 && y <= 9) {
        this.startPointsHitsCoordinates.push([x,y]);
        x = (x <= 9) ? x : 9;
        y = (y <= 9) ? y : 9;
        x++;y++;
      }
    }
  }

  setUselessCell(event){
    event.preventDefault();
    if (computerShooting) return;

    //Преобразование координаты клика в координаты матрицы
    const coordinates = this.transformCoordinatesToMatrix(event, computerGameField);
    //Проверяем наличие иконок в ячейке и от полученного результата делаем те или иные действия
    const checkCoordinates = this.checkUselessCeel(coordinates);
    //Если иконка отсутсвует, то ставим маркер
    if (checkCoordinates) this.showIcons(this.opponent, coordinates, 'shaded-cell');
  }
  transformCoordinatesToMatrix(event, self){
    const x = Math.trunc((event.pageY - self.Top) / Field.SHIP_DECK);
    const y = Math.trunc((event.pageX - self.Left) / Field.SHIP_DECK);
    return [x, y];
  }
  checkUselessCeel(coordinates){
    //Проверка при установке маркера игроком
    if (computerGameField.matrix[coordinates[0]][coordinates[1]] > 1) return false;

    //Коллекция маркеров на игровом поле противника
    const icons = this.opponent.field.querySelectorAll('.shaded-cell');
    if (icons.length === 0) return true;

    for (let icon of icons){
      // Сравнение координат иконки с аргументами функции
      const [x, y] = Controller.getIconCoorinates(icon);
      if (coordinates[0] == x && coordinates[1] == y){
        //Если координаты в аргументе и координаты иконки совпали, то проверяем какая функция вызвала нашу функцию
        const f = (new Error()).stack.split('\n')[2].trim().split(' ')[1];
        if (f == 'Controller.setUselessCell'){
          //Удаляем пустой маркер
          icon.remove();
        }
        else {
          // на секунду окрашиваем маркер в красный свет
          icon.classList.add('shaded-cell_red');
          setTimeout(() => {icon.classList.remove('shaded-cell_red')}, 1000);
        }
        return false;
      }
    }
    return true;
  }

  showIcons(opponent, [x, y], iconClass){
    //Экземпляр поля
    const field = opponent.field;
    if (iconClass === 'dot' || iconClass === 'red-cross') setTimeout(() => fn(), 500);
    else fn();

    function fn(){
      //Создание экземпляра и добавление стилей
      const span = document.createElement('span');
      span.className = `icon-field ${iconClass}`;
      span.style.cssText = `left: ${y * Field.SHIP_DECK}px; top: ${x * Field.SHIP_DECK}px;`;
      field.appendChild(span);
    }
  }

  showExplosion(x,y){
    this.showIcons(this.opponent, [x, y], 'explosion');
    const explosion = this.opponent.field.querySelector('.explosion');
    explosion.classList.add('active');
    setTimeout(() => explosion.remove(), 1000);
  }

  makeShot(event){
    let x, y;
    if (event) {
      if (computerShooting) return;
      ([x,y] = this.transformCoordinatesToMatrix(event, this.opponent));
      //Проверяем наличие иконки выстрела по полученным координатам
      const check = this.checkUselessCeel([x, y]);
      if (!check) return
    } else
      //получаем координаты для выстрела компьютера
      ([x, y] = this.getShotCoordinates());
      this.showExplosion(x, y);

      const shot = this.opponent.matrix[x][y];
      switch (shot) {
        case 0:this.miss(x, y);break;
        case 1:this.hit(x, y); break;
        case 3:
        case 4: Controller.showInfoText("You've shot already here"); break;
      }
    }

    getShotCoordinates(){
      const coordinates = (this.coordinatesAroundHit.length > 0)
        ? this.coordinatesAroundHit.pop()
        : (this.startPointsHitsCoordinates.length > 0)
          ? this.startPointsHitsCoordinates.pop()
          : this.randomHitsCoordinates.pop();
      this.removeCoordinatesFromArrays(coordinates);
      return coordinates;

    }

    removeCoordinatesFromArrays(coordinates){
      if (this.coordinatesAroundHit.length > 0)
        this.coordinatesAroundHit = Controller.removeCoordinateArray(this.coordinatesAroundHit, coordinates);
      if (this.startPointsHitsCoordinates.length > 0)
        this.startPointsHitsCoordinates = Controller.removeCoordinateArray(this.startPointsHitsCoordinates, coordinates);
      this.randomHitsCoordinates = Controller.removeCoordinateArray(this.randomHitsCoordinates, coordinates);
    }

    miss(x, y) {
      let text = '';
      //Устанавливаем иконку промаха и записываем промах в матрицу
      this.showIcons(this.opponent, [x, y], 'dot');
      this.opponent.matrix[x][y] = 3;

      //Статус игроков
      if (this.player === humanGameField){
        text = `${sessionStorage.playerNickname} missed. Computer's shooting`
        this.player = computerGameField;
        this.opponent = humanGameField;
        computerShooting = true;
        setTimeout(() => this.makeShot(), 2000);
      }
      else {
        text = `Computer missed. Its ${sessionStorage.playerNickname}'s turn`;
        //Всевозможные клетки для корабля обстреляны
        if (this.coordinatesAroundHit.length === 0 && this.tempShip.hits > 0){
          //корабль потоплен
          this.markUselessCellAroundShip();
          this.resetTempShip();
        }
        this.player = humanGameField;
        this.opponent = computerGameField;
        computerShooting = false;
      }
    setTimeout(() => Controller.showInfoText(text), 500);
    }

    hit(x, y){
      let text = '';
      //Устанавливаем иконку попадания и записываем в матрицу
      this.showIcons(this.opponent, [x, y], 'red-cross');
      this.opponent.matrix[x][y] = 4;
      text = (this.player === humanGameField) ? `Congratulations, ${sessionStorage.playerNickname}! You hit. Your turn` : 'Computer hits you. Computers turn';
      setTimeout(() => Controller.showInfoText(text), 500);

      //Перебираем корабли эскадры противника
      outerloop:
        for (let name in this.opponent.squadron){
          const dataShip = this.opponent.squadron[name];
          for (let value of dataShip.arrayOfDecks){
            //Перебираем координаты палуб и попаданий
            if (value[0] != x || value[1] != y) continue;
            dataShip.hits++;
            if (dataShip.hits < dataShip.arrayOfDecks.length) break outerloop;
            //Выстрел компьютера - сохраняем координаты первой палубы
            if (this.opponent === humanGameField){
              this.tempShip.x0 = dataShip.x;
              this.tempShip.y0 = dataShip.y;
            }
            //Если количество попаданий в корабль равно количеству палуб, то удаляем корабль из массива
            delete this.opponent.squadron[name];
            break outerloop;
          }
        }

      //Все корабли эскадры уничтожены
      if (Object.keys(this.opponent.squadron).length == 0){
        if (this.opponent === humanGameField){
          text = `${sessionStorage.playerNickname} lost`;
          //Показываем корабли противника
          for (let name in computerGameField.squadron){
            const dataShip = computerGameField.squadron[name];
            Ships.showShip(computerGameField, name, dataShip.x, dataShip.y, dataShip.kx);
          }
        }
        else {
            text = `${sessionStorage.playerNickname} win!`
        }
          Controller.showInfoText(text);
          newGameButton.hidden = false;
        } else if (this.opponent === humanGameField) {
          let coordinates;
          this.tempShip.hits++;

          //Отмечаем клетки по диагонали, где не может стоять корабль
          coordinates = [
            [x - 1, y - 1],
            [x - 1, y + 1],
            [x + 1, y - 1],
            [x + 1, y + 1]
          ];
          this.markUselessCeel(coordinates);

          coordinates = [
            [x-1, y],
            [x+1, y],
            [x, y-1],
            [x, y+1]
          ];
          this.setCoordinatesAroundHit(x, y, coordinates);

          //Проверяем потоплен ли корабль, в который попали
          this.isShipDestroyed();

          //Новый выстрел компьютера
          setTimeout(() => this.makeShot(), 2000);
        }
    }
    markUselessCeel(coordinates){
      let n = 1, x, y;
      for (let coordinate of coordinates){
        x = coordinate[0]; y = coordinate[1];
        if (x < 0 || y < 0 || x > 9 || y > 9) continue;
        //По этим координатам уже есть маркер
        if (humanGameField.matrix[x][y] === 2 || humanGameField.matrix[x][y] === 3) continue;
        //Значение пустой клетки
        humanGameField.matrix[x][y] = 2;
        //Вывод маркеров пустых клеток
        setTimeout(() => this.showIcons(humanGameField, coordinate, 'shaded-cell'), 300*n);
        //Удаляем координаты из всех массивов
        this.removeCoordinatesFromArrays(coordinate);
        n++;
      }
    }

    markUselessCellAroundShip(){
      const {hits, kx, ky, x0, y0} = this.tempShip;
      let coordinates;

      //Рассчет координат пустых клеток

      //Однопалубный корабль
      if (this.tempShip.hits == 1){
        coordinates = [
          [x0 - 1, y0],
          [x0 + 1, y0],
          [x0, y0 - 1],
          [x0, y0 + 1]
        ];
      }
      else {
        //Многопалубный корабль
        coordinates = [
          [x0 - kx, y0 - ky],
          [x0 + kx * hits, y0 + ky * hits]
        ];
      }
      this.markUselessCeel(coordinates);
    }

    isShipDestroyed(){
      //Максимальное количество палуб у оставшихся кораблей
      let ship = Object.values(humanGameField.squadron).reduce((a, b) =>
            a.arrayOfDecks.length > b.arrayOfDecks.length ? a : b);
      //Узнаем есть ли еще корабли с количеством палуб больше, чем попаданий
      if (this.tempShip.hits >= ship.arrayOfDecks.length || this.coordinatesAroundHit.length === 0){
        //Корабль потоплен
        this.markUselessCellAroundShip();
        //Очищаем массив и объект для обстрела следующего корабля
        this.coordinatesAroundHit = [];
        this.resetTempShip();
      }
    }
    setCoordinatesAroundHit(x, y, coordinates){
      let {firstHit, kx, ky} = this.tempShip;

      //Первое попадание в корабль
      if (firstHit.length === 0) this.tempShip.firstHit = [x, y];
      //Второе попадание
      else if (kx === 0 && ky === 0){
        //зная координаты первого и второго попадания вычисляем координаты корабля
        this.tempShip.kx = (Math.abs(firstHit[0] - x) === 1) ? 1 : 0;
        this.tempShip.ky = (Math.abs(firstHit[1] - y) === 1) ? 1 : 0;
      }

      //Проверка корректности координат обстрела
      for (let coordinate of coordinates){
        x = coordinate[0];y = coordinate[1];
        if (x < 0 || y < 0 || x > 9 || y > 9) continue;
        //Промах или маркер пустой клетки на данных координатах
        if (humanGameField.matrix[x][y] != 0 && humanGameField.matrix[x][y] != 1) continue;
        this.coordinatesAroundHit.push([x, y]);
      }
    }
}

///////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////////////////////////////

  //Контейнер с заголовочным текстом
  const textOnTop = getElement("textAbove");
  //Кнопкой Play
  const playButton = getElement("playButton");
  //Кнопка New Game
  const newGameButton = getElement("newGameButton");

  const randomShipGeneration = getElement("randomShipGeneration");

  const inputNickname = getElement('inputNickname');

  const labelNick = getElement('nicknameLabel');

  //Экземпляр поля игрока
  const humanGameField = new Field(humanField);

  let computerGameField = {};

  let controller = null;

  //Вешаем обработчик события на нажатие на рандомную генерацию кораблей
  randomShipGeneration.addEventListener('click', function() {
    //очищаем игровое поле игрока
    humanGameField.cleanGameField();
    //Скрываем кнопку начала игры
    playButton.hidden = false;
    //Вызов функции рандомной расстановки кораблей
    humanGameField.randomShipLocation();
  });

  playButton.addEventListener('click',function(){
    //Скрываем ненудные элементы
    playButton.hidden = true;

    randomShipGeneration.hidden = true; 

    labelNick.hidden = true;

    inputNickname.hidden = true;
    //Показываем поле компьютера
    computerField.parentElement.hidden = false;



    textOnTop.innerHTML = "Battle started";

    //Экземпляр поля компьютера
    computerGameField = new Field(computerField);
    //Очищаем поле и рандомно расставляем корабли
    computerGameField.cleanGameField();

    computerGameField.randomShipLocation();

    //Создаем экземпляр контроллера, управляющего игрой
    if (!controller) controller = new Controller();
    //Старт
    controller.init();

    sessionStorage.playerNickname = inputNickname.value;

    if (sessionStorage.playerNickname == '') sessionStorage.playerNickname = 'Player';

    inputNickname.hidden = true;

  });

  newGameButton.addEventListener('click', function(){

    newGameButton.hidden = true;
    computerField.parentElement.hidden = true;

    randomShipGeneration.hidden = false;

    inputNickname.hidden = false;

    label.hidden = false;

    humanGameField.cleanGameField();
    textOnTop.innerHTML = 'Placement of ships';
    Controller.INFO_BLOCK.innerHTML = '';

    computerShooting = false;

    controller.randomHitsCoordinates = [];
    controller.startPointsHitsCoordinates = [];
    controller.coordinatesAroundHit = [];

    sessionStorage.playerNickname = ''

    controller.resetTempShip();
  })


})();
