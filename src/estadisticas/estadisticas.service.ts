import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EjecucionRuta, Incidencia, PuntoRutaEjecucion } from 'src/common/entities';
import {
  EstadoEjecucionPuntoRutaEnum,
  EstadoEjecucionRutaEnum,
  EstadoIncidenciaEnum,
  PrioridadIncidenciaEnum,
  TipoPuntoColeccionEnum,
} from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { FiltroMetricasCamionerosDto } from './dto/filtro-metricas-camioneros.dto';
import { FiltroMetricasIncidenciasDto } from './dto/filtro-metricas-incidencias.dto';
import { FiltroMetricasPuntosRetiroDto } from './dto/filtro-metricas-puntos-retiro.dto';
import { FiltroMetricasRutasDto } from './dto/filtro-metricas-rutas.dto';

const MARGEN_MINUTOS_A_TIEMPO_DEFAULT = 15;

@Injectable()
export class EstadisticasService {
  constructor(
    @InjectRepository(EjecucionRuta)
    private readonly ejecucionRutaRepository: Repository<EjecucionRuta>,

    @InjectRepository(Incidencia)
    private readonly incidenciaRepository: Repository<Incidencia>,

    @InjectRepository(PuntoRutaEjecucion)
    private readonly puntoRutaEjecucionRepository: Repository<PuntoRutaEjecucion>,
  ) {}

  async obtenerMetricasRutas(filtro: FiltroMetricasRutasDto = {}) {
    const { desde, hasta } = filtro;
    const margenMinutosATiempo =
      filtro.margenMinutosATiempo ?? MARGEN_MINUTOS_A_TIEMPO_DEFAULT;

    const [
      totalEjecuciones,
      distribucionPorEstado,
      rutasDiariasEjecutadas,
      metricasTiempo,
      metricasIncidencias,
      metricasKilometros,
    ] = await Promise.all([
      this.contarEjecuciones(desde, hasta),
      this.obtenerDistribucionPorEstado(desde, hasta),
      this.obtenerRutasDiariasEjecutadas(desde, hasta),
      this.obtenerMetricasTiempo(desde, hasta, margenMinutosATiempo),
      this.obtenerIncidenciasPorEjecucion(desde, hasta),
      this.obtenerMetricasKilometros(desde, hasta),
    ]);

    const porcentajeCompletadasATiempo = this.calcularPorcentaje(
      metricasTiempo.aTiempo,
      metricasTiempo.evaluables,
    );

    const porcentajeConIncidencias = this.calcularPorcentaje(
      metricasIncidencias.conIncidencias,
      metricasIncidencias.total,
    );

    const data = {
      periodo: { desde: desde ?? null, hasta: hasta ?? null },
      margenMinutosATiempo,
      resumen: {
        totalEjecuciones,
        totalEvaluablesTiempo: metricasTiempo.evaluables,
        completadasATiempo: metricasTiempo.aTiempo,
        porcentajeCompletadasATiempo,
        ejecucionesConIncidencias: metricasIncidencias.conIncidencias,
        porcentajeConIncidencias,
        promedioKilometrosRecorridos: metricasKilometros.promedio,
        totalConOdometroRegistrado: metricasKilometros.totalConOdometro,
      },
      distribucionPorEstado,
      rutasDiariasEjecutadas,
    };

    return buildResponse(
      HttpStatus.OK,
      'MÃ©tricas de rutas y ejecuciÃ³n obtenidas correctamente',
      data,
    );
  }

  async obtenerMetricasIncidencias(filtro: FiltroMetricasIncidenciasDto = {}) {
    const { desde, hasta } = filtro;

    const [
      totalIncidencias,
      distribucionPorEstado,
      distribucionPorPrioridad,
      porTipo,
      porZona,
      incidenciasDiariasReportadas,
      metricasResolucion,
      distribucionPorContexto,
      backlogActual,
    ] = await Promise.all([
      this.contarIncidencias(desde, hasta),
      this.obtenerDistribucionIncidenciasPorEstado(desde, hasta),
      this.obtenerDistribucionIncidenciasPorPrioridad(desde, hasta),
      this.obtenerIncidenciasPorTipo(desde, hasta),
      this.obtenerIncidenciasPorZona(desde, hasta),
      this.obtenerIncidenciasDiariasReportadas(desde, hasta),
      this.obtenerMetricasResolucionIncidencias(desde, hasta),
      this.obtenerDistribucionContextoIncidencias(desde, hasta),
      this.obtenerBacklogIncidencias(),
    ]);

    const porAtender =
      distribucionPorEstado[EstadoIncidenciaEnum.ABIERTA] +
      distribucionPorEstado[EstadoIncidenciaEnum.EN_PROGRESO];

    const atendidas =
      distribucionPorEstado[EstadoIncidenciaEnum.RESUELTA] +
      distribucionPorEstado[EstadoIncidenciaEnum.CERRADA];

    const data = {
      periodo: { desde: desde ?? null, hasta: hasta ?? null },
      resumen: {
        totalIncidencias,
        porAtender,
        atendidas,
        porcentajeAtendidas: this.calcularPorcentaje(atendidas, totalIncidencias),
        porcentajePorAtender: this.calcularPorcentaje(
          porAtender,
          totalIncidencias,
        ),
        tiempoPromedioResolucionMinutos: metricasResolucion.promedioMinutos,
        totalConResolucionRegistrada: metricasResolucion.totalConResolucion,
      },
      backlogActual,
      distribucionPorEstado,
      distribucionPorPrioridad,
      porTipo,
      porZona,
      distribucionPorContexto,
      incidenciasDiariasReportadas,
    };

    return buildResponse(
      HttpStatus.OK,
      'MÃ©tricas de incidencias obtenidas correctamente',
      data,
    );
  }

  async obtenerMetricasPuntosRetiro(filtro: FiltroMetricasPuntosRetiroDto = {}) {
    const { desde, hasta } = filtro;

    const [
      totalPuntos,
      distribucionPorEstado,
      distribucionPorTipoPunto,
      porZona,
      porcentajeAtendidosPorRuta,
      puntosConMasProblemas,
      puntosAtendidosDiarios,
      backlogActual,
    ] = await Promise.all([
      this.contarPuntosRetiro(desde, hasta),
      this.obtenerDistribucionPuntosPorEstado(desde, hasta),
      this.obtenerDistribucionPuntosPorTipo(desde, hasta),
      this.obtenerMetricasPuntosPorZona(desde, hasta),
      this.obtenerPorcentajeAtendidosPorRuta(desde, hasta),
      this.obtenerPuntosConMasProblemas(desde, hasta),
      this.obtenerPuntosAtendidosDiarios(desde, hasta),
      this.obtenerBacklogPuntosRetiro(),
    ]);

    const atendidos =
      distribucionPorEstado[EstadoEjecucionPuntoRutaEnum.COMPLETADO];
    const porAtender =
      distribucionPorEstado[EstadoEjecucionPuntoRutaEnum.PENDIENTE];
    const saltados =
      distribucionPorEstado[EstadoEjecucionPuntoRutaEnum.SALTADO];
    const fallidos =
      distribucionPorEstado[EstadoEjecucionPuntoRutaEnum.FALLIDO];

    const data = {
      periodo: { desde: desde ?? null, hasta: hasta ?? null },
      resumen: {
        totalPuntos,
        atendidos,
        porAtender,
        saltados,
        fallidos,
        porcentajeAtendidos: this.calcularPorcentaje(atendidos, totalPuntos),
        porcentajePorAtender: this.calcularPorcentaje(porAtender, totalPuntos),
      },
      backlogActual,
      distribucionPorEstado,
      distribucionPorTipoPunto,
      porZona,
      porcentajeAtendidosPorRuta,
      puntosConMasProblemas,
      puntosAtendidosDiarios,
    };

    return buildResponse(
      HttpStatus.OK,
      'MÃ©tricas de puntos de retiro obtenidas correctamente',
      data,
    );
  }

  async obtenerMetricasCamioneros(filtro: FiltroMetricasCamionerosDto = {}) {
    const { desde, hasta } = filtro;
    const margenMinutosATiempo =
      filtro.margenMinutosATiempo ?? MARGEN_MINUTOS_A_TIEMPO_DEFAULT;

    const [
      detalleRutas,
      puntosPorConductor,
      incidenciasEnRutas,
      incidenciasReportadas,
      backlogActual,
    ] = await Promise.all([
      this.obtenerDetalleRutasCamioneros(desde, hasta, margenMinutosATiempo),
      this.obtenerPuntosPorConductor(desde, hasta),
      this.obtenerIncidenciasEnRutasPorConductor(desde, hasta),
      this.obtenerIncidenciasReportadasPorConductor(desde, hasta),
      this.obtenerBacklogCamioneros(),
    ]);

    const puntosMap = new Map(
      puntosPorConductor.map((item) => [item.conductorId, item]),
    );
    const incidenciasRutasMap = new Map(
      incidenciasEnRutas.map((item) => [item.conductorId, item.total]),
    );
    const incidenciasReportadasMap = new Map(
      incidenciasReportadas.map((item) => [item.conductorId, item.total]),
    );

    const porConductor = detalleRutas.map((conductor) => {
      const puntos = puntosMap.get(conductor.conductorId);
      const puntosTotales = puntos?.puntosTotales ?? 0;
      const puntosAtendidos = puntos?.puntosAtendidos ?? 0;

      return {
        ...conductor,
        porcentajeCompletadasATiempo: this.calcularPorcentaje(
          conductor.rutasCompletadasATiempo,
          conductor.rutasEvaluablesTiempo,
        ),
        puntosTotales,
        puntosAtendidos,
        porcentajePuntosAtendidos: this.calcularPorcentaje(
          puntosAtendidos,
          puntosTotales,
        ),
        incidenciasEnSusRutas:
          incidenciasRutasMap.get(conductor.conductorId) ?? 0,
        incidenciasReportadas:
          incidenciasReportadasMap.get(conductor.conductorId) ?? 0,
      };
    });

    const rankingMasRutas = [...porConductor].sort(
      (a, b) => b.rutasAsignadas - a.rutasAsignadas,
    );

    const rankingMenorTiempoPromedio = porConductor
      .filter((item) => item.tiempoPromedioMinutosPorRuta != null)
      .sort(
        (a, b) =>
          (a.tiempoPromedioMinutosPorRuta ?? 0) -
          (b.tiempoPromedioMinutosPorRuta ?? 0),
      );

    const data = {
      periodo: { desde: desde ?? null, hasta: hasta ?? null },
      margenMinutosATiempo,
      resumen: {
        totalCamionerosConActividad: porConductor.length,
        totalRutasAsignadas: porConductor.reduce(
          (acc, item) => acc + item.rutasAsignadas,
          0,
        ),
        totalRutasEjecutadas: porConductor.reduce(
          (acc, item) => acc + item.rutasEjecutadas,
          0,
        ),
        totalRutasCompletadas: porConductor.reduce(
          (acc, item) => acc + item.rutasCompletadas,
          0,
        ),
      },
      rankingMasRutas,
      rankingMenorTiempoPromedio,
      backlogActual,
      porConductor,
    };

    return buildResponse(
      HttpStatus.OK,
      'MÃ©tricas de camioneros obtenidas correctamente',
      data,
    );
  }

  private crearQueryBase(
    desde?: string,
    hasta?: string,
  ): SelectQueryBuilder<EjecucionRuta> {
    const qb = this.ejecucionRutaRepository
      .createQueryBuilder('e')
      .innerJoin('e.asignacionRuta', 'a');

    this.aplicarFiltroFecha(qb, desde, hasta);
    return qb;
  }

  private crearQueryBasePuntosRetiro(
    desde?: string,
    hasta?: string,
  ): SelectQueryBuilder<PuntoRutaEjecucion> {
    const qb = this.puntoRutaEjecucionRepository
      .createQueryBuilder('pre')
      .innerJoin('pre.ejecucionRuta', 'e')
      .innerJoin('e.asignacionRuta', 'a');

    this.aplicarFiltroFechaPuntos(qb, desde, hasta);
    return qb;
  }

  private aplicarFiltroFechaPuntos(
    qb: SelectQueryBuilder<PuntoRutaEjecucion>,
    desde?: string,
    hasta?: string,
  ): void {
    if (desde) {
      qb.andWhere('a.fecha_asignacion >= :desde', { desde });
    }
    if (hasta) {
      qb.andWhere('a.fecha_asignacion <= :hasta', { hasta });
    }
  }

  private construirFiltroFechaAsignacionSql(
    desde?: string,
    hasta?: string,
    indiceInicial = 1,
  ): { sql: string; parametros: unknown[]; siguienteIndice: number } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];
    let indice = indiceInicial;

    if (desde) {
      condiciones.push(`a.fecha_asignacion >= $${indice}`);
      parametros.push(desde);
      indice++;
    }
    if (hasta) {
      condiciones.push(`a.fecha_asignacion <= $${indice}`);
      parametros.push(hasta);
      indice++;
    }

    const sql =
      condiciones.length > 0 ? `AND ${condiciones.join(' AND ')}` : '';

    return { sql, parametros, siguienteIndice: indice };
  }

  private async contarPuntosRetiro(
    desde?: string,
    hasta?: string,
  ): Promise<number> {
    return this.crearQueryBasePuntosRetiro(desde, hasta).getCount();
  }

  private async obtenerDistribucionPuntosPorEstado(
    desde?: string,
    hasta?: string,
  ): Promise<Record<EstadoEjecucionPuntoRutaEnum, number>> {
    const distribucion = Object.values(EstadoEjecucionPuntoRutaEnum).reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {} as Record<EstadoEjecucionPuntoRutaEnum, number>,
    );

    const filas = await this.crearQueryBasePuntosRetiro(desde, hasta)
      .select('pre.estado', 'estado')
      .addSelect('COUNT(pre.id)', 'cantidad')
      .groupBy('pre.estado')
      .getRawMany<{ estado: EstadoEjecucionPuntoRutaEnum; cantidad: string }>();

    for (const fila of filas) {
      distribucion[fila.estado] = Number(fila.cantidad);
    }

    return distribucion;
  }

  private async obtenerDistribucionPuntosPorTipo(
    desde?: string,
    hasta?: string,
  ): Promise<Record<TipoPuntoColeccionEnum, number>> {
    const distribucion = Object.values(TipoPuntoColeccionEnum).reduce(
      (acc, tipo) => {
        acc[tipo] = 0;
        return acc;
      },
      {} as Record<TipoPuntoColeccionEnum, number>,
    );

    const filas = await this.crearQueryBasePuntosRetiro(desde, hasta)
      .innerJoin('pre.puntoRecoleccion', 'pr')
      .select('pr.tipo_punto', 'tipoPunto')
      .addSelect('COUNT(pre.id)', 'cantidad')
      .groupBy('pr.tipo_punto')
      .getRawMany<{ tipoPunto: TipoPuntoColeccionEnum; cantidad: string }>();

    for (const fila of filas) {
      distribucion[fila.tipoPunto] = Number(fila.cantidad);
    }

    return distribucion;
  }

  private async obtenerMetricasPuntosPorZona(
    desde?: string,
    hasta?: string,
  ): Promise<
    Array<{
      zonaId: string;
      zonaNombre: string;
      total: number;
      atendidos: number;
      porcentajeAtendidos: number | null;
    }>
  > {
    const { sql, parametros } = this.construirFiltroFechaAsignacionSql(
      desde,
      hasta,
    );

    const filas = await this.puntoRutaEjecucionRepository.query(
      `
      SELECT
        z.id AS zona_id,
        z.nombre AS zona_nombre,
        COUNT(pre.id)::int AS total,
        COUNT(*) FILTER (WHERE pre.estado = 'COMPLETADO')::int AS atendidos
      FROM punto_ruta_ejecucion pre
      INNER JOIN ejecucion_rutas e ON e.id = pre.ejecucion_ruta_id
      INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
      INNER JOIN puntos_recoleccion pr ON pr.id = pre.punto_recoleccion_id
      INNER JOIN zonas z ON z.id = pr.zona_id
      WHERE 1 = 1
        ${sql}
      GROUP BY z.id, z.nombre
      ORDER BY total DESC
      `,
      parametros,
    );

    return filas.map(
      (fila: {
        zona_id: string;
        zona_nombre: string;
        total: number;
        atendidos: number;
      }) => ({
        zonaId: fila.zona_id,
        zonaNombre: fila.zona_nombre,
        total: Number(fila.total),
        atendidos: Number(fila.atendidos),
        porcentajeAtendidos: this.calcularPorcentaje(
          Number(fila.atendidos),
          Number(fila.total),
        ),
      }),
    );
  }

  private async obtenerPorcentajeAtendidosPorRuta(
    desde?: string,
    hasta?: string,
  ): Promise<
    Array<{
      rutaId: string;
      rutaNombre: string;
      total: number;
      atendidos: number;
      porcentajeAtendidos: number | null;
    }>
  > {
    const { sql, parametros } = this.construirFiltroFechaAsignacionSql(
      desde,
      hasta,
    );

    const filas = await this.puntoRutaEjecucionRepository.query(
      `
      SELECT
        r.id AS ruta_id,
        r.nombre AS ruta_nombre,
        COUNT(pre.id)::int AS total,
        COUNT(*) FILTER (WHERE pre.estado = 'COMPLETADO')::int AS atendidos
      FROM punto_ruta_ejecucion pre
      INNER JOIN ejecucion_rutas e ON e.id = pre.ejecucion_ruta_id
      INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
      INNER JOIN rutas r ON r.id = a.ruta_id
      WHERE 1 = 1
        ${sql}
      GROUP BY r.id, r.nombre
      ORDER BY total DESC
      `,
      parametros,
    );

    return filas
      .map(
        (fila: {
          ruta_id: string;
          ruta_nombre: string;
          total: number;
          atendidos: number;
        }) => ({
          rutaId: fila.ruta_id,
          rutaNombre: fila.ruta_nombre,
          total: Number(fila.total),
          atendidos: Number(fila.atendidos),
          porcentajeAtendidos: this.calcularPorcentaje(
            Number(fila.atendidos),
            Number(fila.total),
          ),
        }),
      )
      .sort(
        (a, b) =>
          (a.porcentajeAtendidos ?? 0) - (b.porcentajeAtendidos ?? 0) ||
          b.total - a.total,
      );
  }

  private async obtenerPuntosConMasProblemas(
    desde?: string,
    hasta?: string,
  ): Promise<
    Array<{
      puntoRecoleccionId: string;
      puntoNombre: string;
      totalIncidencias: number;
      vecesFallido: number;
      vecesSaltado: number;
      indiceProblemas: number;
    }>
  > {
    const { sql, parametros } = this.construirFiltroFechaAsignacionSql(
      desde,
      hasta,
    );

    const filas = await this.puntoRutaEjecucionRepository.query(
      `
      SELECT
        pr.id AS punto_id,
        pr.nombre AS punto_nombre,
        COUNT(DISTINCT i.id)::int AS total_incidencias,
        COUNT(*) FILTER (WHERE pre.estado = 'FALLIDO')::int AS veces_fallido,
        COUNT(*) FILTER (WHERE pre.estado = 'SALTADO')::int AS veces_saltado,
        (
          COUNT(DISTINCT i.id)
          + COUNT(*) FILTER (WHERE pre.estado = 'FALLIDO')
          + COUNT(*) FILTER (WHERE pre.estado = 'SALTADO')
        )::int AS indice_problemas
      FROM punto_ruta_ejecucion pre
      INNER JOIN ejecucion_rutas e ON e.id = pre.ejecucion_ruta_id
      INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
      INNER JOIN puntos_recoleccion pr ON pr.id = pre.punto_recoleccion_id
      LEFT JOIN incidencias i ON i.punto_ejecucion_ruta_id = pre.id
      WHERE 1 = 1
        ${sql}
      GROUP BY pr.id, pr.nombre
      HAVING (
        COUNT(DISTINCT i.id)
        + COUNT(*) FILTER (WHERE pre.estado = 'FALLIDO')
        + COUNT(*) FILTER (WHERE pre.estado = 'SALTADO')
      ) > 0
      ORDER BY indice_problemas DESC, total_incidencias DESC
      LIMIT 10
      `,
      parametros,
    );

    return filas.map(
      (fila: {
        punto_id: string;
        punto_nombre: string;
        total_incidencias: number;
        veces_fallido: number;
        veces_saltado: number;
        indice_problemas: number;
      }) => ({
        puntoRecoleccionId: fila.punto_id,
        puntoNombre: fila.punto_nombre,
        totalIncidencias: Number(fila.total_incidencias),
        vecesFallido: Number(fila.veces_fallido),
        vecesSaltado: Number(fila.veces_saltado),
        indiceProblemas: Number(fila.indice_problemas),
      }),
    );
  }

  private async obtenerPuntosAtendidosDiarios(
    desde?: string,
    hasta?: string,
  ): Promise<Array<{ fecha: string; cantidad: number }>> {
    const filas = await this.crearQueryBasePuntosRetiro(desde, hasta)
      .andWhere('pre.estado = :completado', {
        completado: EstadoEjecucionPuntoRutaEnum.COMPLETADO,
      })
      .andWhere('pre.tiempo_chequeo IS NOT NULL')
      .select('DATE(pre.tiempo_chequeo)', 'fecha')
      .addSelect('COUNT(pre.id)', 'cantidad')
      .groupBy('DATE(pre.tiempo_chequeo)')
      .orderBy('DATE(pre.tiempo_chequeo)', 'ASC')
      .getRawMany<{ fecha: string; cantidad: string }>();

    return filas.map((fila) => ({
      fecha: fila.fecha,
      cantidad: Number(fila.cantidad),
    }));
  }

  private async obtenerBacklogPuntosRetiro(): Promise<{
    porAtenderEnEjecucionesActivas: number;
    porAtenderEnEjecucionesParciales: number;
  }> {
    const [fila] = await this.puntoRutaEjecucionRepository.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE pre.estado = 'PENDIENTE'
            AND e.estado = 'EN_PROGRESO'
        )::int AS por_atender_activas,
        COUNT(*) FILTER (
          WHERE pre.estado = 'PENDIENTE'
            AND e.estado = 'PARCIAL'
        )::int AS por_atender_parciales
      FROM punto_ruta_ejecucion pre
      INNER JOIN ejecucion_rutas e ON e.id = pre.ejecucion_ruta_id
    `);

    return {
      porAtenderEnEjecucionesActivas: Number(fila?.por_atender_activas ?? 0),
      porAtenderEnEjecucionesParciales: Number(
        fila?.por_atender_parciales ?? 0,
      ),
    };
  }

  private crearQueryBaseIncidencias(
    desde?: string,
    hasta?: string,
  ): SelectQueryBuilder<Incidencia> {
    const qb = this.incidenciaRepository.createQueryBuilder('i');
    this.aplicarFiltroFechaReporte(qb, desde, hasta);
    return qb;
  }

  private aplicarFiltroFechaReporte(
    qb: SelectQueryBuilder<Incidencia>,
    desde?: string,
    hasta?: string,
  ): void {
    if (desde) {
      qb.andWhere('DATE(i.reported_at) >= :desde', { desde });
    }
    if (hasta) {
      qb.andWhere('DATE(i.reported_at) <= :hasta', { hasta });
    }
  }

  private async contarIncidencias(
    desde?: string,
    hasta?: string,
  ): Promise<number> {
    return this.crearQueryBaseIncidencias(desde, hasta).getCount();
  }

  private async obtenerDistribucionIncidenciasPorEstado(
    desde?: string,
    hasta?: string,
  ): Promise<Record<EstadoIncidenciaEnum, number>> {
    const distribucion = Object.values(EstadoIncidenciaEnum).reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {} as Record<EstadoIncidenciaEnum, number>,
    );

    const filas = await this.crearQueryBaseIncidencias(desde, hasta)
      .select('i.estado', 'estado')
      .addSelect('COUNT(i.id)', 'cantidad')
      .groupBy('i.estado')
      .getRawMany<{ estado: EstadoIncidenciaEnum; cantidad: string }>();

    for (const fila of filas) {
      distribucion[fila.estado] = Number(fila.cantidad);
    }

    return distribucion;
  }

  private async obtenerDistribucionIncidenciasPorPrioridad(
    desde?: string,
    hasta?: string,
  ): Promise<Record<PrioridadIncidenciaEnum, number>> {
    const distribucion = Object.values(PrioridadIncidenciaEnum).reduce(
      (acc, prioridad) => {
        acc[prioridad] = 0;
        return acc;
      },
      {} as Record<PrioridadIncidenciaEnum, number>,
    );

    const filas = await this.crearQueryBaseIncidencias(desde, hasta)
      .select('i.prioridad', 'prioridad')
      .addSelect('COUNT(i.id)', 'cantidad')
      .groupBy('i.prioridad')
      .getRawMany<{ prioridad: PrioridadIncidenciaEnum; cantidad: string }>();

    for (const fila of filas) {
      distribucion[fila.prioridad] = Number(fila.cantidad);
    }

    return distribucion;
  }

  private async obtenerIncidenciasPorTipo(
    desde?: string,
    hasta?: string,
  ): Promise<
    Array<{ tipoId: string; tipoNombre: string; cantidad: number }>
  > {
    const filas = await this.crearQueryBaseIncidencias(desde, hasta)
      .innerJoin('i.tipoIncidencia', 't')
      .select('t.id', 'tipoId')
      .addSelect('t.nombre', 'tipoNombre')
      .addSelect('COUNT(i.id)', 'cantidad')
      .groupBy('t.id')
      .addGroupBy('t.nombre')
      .orderBy('cantidad', 'DESC')
      .getRawMany<{ tipoId: string; tipoNombre: string; cantidad: string }>();

    return filas.map((fila) => ({
      tipoId: fila.tipoId,
      tipoNombre: fila.tipoNombre,
      cantidad: Number(fila.cantidad),
    }));
  }

  private async obtenerIncidenciasPorZona(
    desde?: string,
    hasta?: string,
  ): Promise<Array<{ zonaId: string; zonaNombre: string; cantidad: number }>> {
    const filas = await this.crearQueryBaseIncidencias(desde, hasta)
      .innerJoin('i.puntoEjecucionRuta', 'pre')
      .innerJoin('pre.puntoRecoleccion', 'pr')
      .innerJoin('pr.zona', 'z')
      .select('z.id', 'zonaId')
      .addSelect('z.nombre', 'zonaNombre')
      .addSelect('COUNT(i.id)', 'cantidad')
      .groupBy('z.id')
      .addGroupBy('z.nombre')
      .orderBy('cantidad', 'DESC')
      .getRawMany<{ zonaId: string; zonaNombre: string; cantidad: string }>();

    return filas.map((fila) => ({
      zonaId: fila.zonaId,
      zonaNombre: fila.zonaNombre,
      cantidad: Number(fila.cantidad),
    }));
  }

  private async obtenerIncidenciasDiariasReportadas(
    desde?: string,
    hasta?: string,
  ): Promise<Array<{ fecha: string; cantidad: number }>> {
    const filas = await this.crearQueryBaseIncidencias(desde, hasta)
      .select('DATE(i.reported_at)', 'fecha')
      .addSelect('COUNT(i.id)', 'cantidad')
      .groupBy('DATE(i.reported_at)')
      .orderBy('DATE(i.reported_at)', 'ASC')
      .getRawMany<{ fecha: string; cantidad: string }>();

    return filas.map((fila) => ({
      fecha: fila.fecha,
      cantidad: Number(fila.cantidad),
    }));
  }

  private async obtenerMetricasResolucionIncidencias(
    desde?: string,
    hasta?: string,
  ): Promise<{ promedioMinutos: number | null; totalConResolucion: number }> {
    const condicionesFecha: string[] = [];
    const parametros: unknown[] = [];
    let indice = 1;

    if (desde) {
      condicionesFecha.push(`DATE(i.reported_at) >= $${indice}`);
      parametros.push(desde);
      indice++;
    }
    if (hasta) {
      condicionesFecha.push(`DATE(i.reported_at) <= $${indice}`);
      parametros.push(hasta);
      indice++;
    }

    const filtroFecha =
      condicionesFecha.length > 0
        ? `AND ${condicionesFecha.join(' AND ')}`
        : '';

    const [fila] = await this.incidenciaRepository.query(
      `
      SELECT
        COUNT(*)::int AS total_con_resolucion,
        ROUND(
          AVG(
            EXTRACT(EPOCH FROM (i.resolved_at - i.reported_at)) / 60.0
          )::numeric,
          2
        ) AS promedio_minutos
      FROM incidencias i
      WHERE i.resolved_at IS NOT NULL
        AND i.estado IN ('RESUELTA', 'CERRADA')
        ${filtroFecha}
      `,
      parametros,
    );

    const totalConResolucion = Number(fila?.total_con_resolucion ?? 0);
    const promedioMinutos =
      fila?.promedio_minutos != null ? Number(fila.promedio_minutos) : null;

    return { promedioMinutos, totalConResolucion };
  }

  private async obtenerDistribucionContextoIncidencias(
    desde?: string,
    hasta?: string,
  ): Promise<{
    vinculadasAEjecucionRuta: number;
    vinculadasAPunto: number;
  }> {
    const fila = await this.crearQueryBaseIncidencias(desde, hasta)
      .select(
        `COUNT(i.id) FILTER (WHERE i.ejecucion_ruta_id IS NOT NULL)`,
        'vinculadasAEjecucionRuta',
      )
      .addSelect(
        `COUNT(i.id) FILTER (WHERE i.punto_ejecucion_ruta_id IS NOT NULL)`,
        'vinculadasAPunto',
      )
      .getRawOne<{
        vinculadasAEjecucionRuta: string;
        vinculadasAPunto: string;
      }>();

    return {
      vinculadasAEjecucionRuta: Number(fila?.vinculadasAEjecucionRuta ?? 0),
      vinculadasAPunto: Number(fila?.vinculadasAPunto ?? 0),
    };
  }

  private async obtenerBacklogIncidencias(): Promise<{
    porAtender: number;
    masDe24Horas: number;
    masDe72Horas: number;
  }> {
    const [fila] = await this.incidenciaRepository.query(`
      SELECT
        COUNT(*)::int AS por_atender,
        COUNT(*) FILTER (
          WHERE i.reported_at < NOW() - INTERVAL '24 hours'
        )::int AS mas_de_24_horas,
        COUNT(*) FILTER (
          WHERE i.reported_at < NOW() - INTERVAL '72 hours'
        )::int AS mas_de_72_horas
      FROM incidencias i
      WHERE i.estado IN ('ABIERTA', 'EN_PROGRESO')
    `);

    return {
      porAtender: Number(fila?.por_atender ?? 0),
      masDe24Horas: Number(fila?.mas_de_24_horas ?? 0),
      masDe72Horas: Number(fila?.mas_de_72_horas ?? 0),
    };
  }

  private aplicarFiltroFecha(
    qb: SelectQueryBuilder<EjecucionRuta>,
    desde?: string,
    hasta?: string,
  ): void {
    if (desde) {
      qb.andWhere('a.fecha_asignacion >= :desde', { desde });
    }
    if (hasta) {
      qb.andWhere('a.fecha_asignacion <= :hasta', { hasta });
    }
  }

  private async contarEjecuciones(
    desde?: string,
    hasta?: string,
  ): Promise<number> {
    return this.crearQueryBase(desde, hasta).getCount();
  }

  private async obtenerDistribucionPorEstado(
    desde?: string,
    hasta?: string,
  ): Promise<Record<EstadoEjecucionRutaEnum, number>> {
    const distribucion = Object.values(EstadoEjecucionRutaEnum).reduce(
      (acc, estado) => {
        acc[estado] = 0;
        return acc;
      },
      {} as Record<EstadoEjecucionRutaEnum, number>,
    );

    const filas = await this.crearQueryBase(desde, hasta)
      .select('e.estado', 'estado')
      .addSelect('COUNT(e.id)', 'cantidad')
      .groupBy('e.estado')
      .getRawMany<{ estado: EstadoEjecucionRutaEnum; cantidad: string }>();

    for (const fila of filas) {
      distribucion[fila.estado] = Number(fila.cantidad);
    }

    return distribucion;
  }

  private async obtenerRutasDiariasEjecutadas(
    desde?: string,
    hasta?: string,
  ): Promise<Array<{ fecha: string; cantidad: number }>> {
    const filas = await this.crearQueryBase(desde, hasta)
      .select('a.fecha_asignacion', 'fecha')
      .addSelect('COUNT(e.id)', 'cantidad')
      .andWhere('e.estado != :noIniciado', {
        noIniciado: EstadoEjecucionRutaEnum.NO_INICIADO,
      })
      .groupBy('a.fecha_asignacion')
      .orderBy('a.fecha_asignacion', 'ASC')
      .getRawMany<{ fecha: string; cantidad: string }>();

    return filas.map((fila) => ({
      fecha: fila.fecha,
      cantidad: Number(fila.cantidad),
    }));
  }

  private async obtenerMetricasTiempo(
    desde?: string,
    hasta?: string,
    margenMinutos: number = MARGEN_MINUTOS_A_TIEMPO_DEFAULT,
  ): Promise<{ evaluables: number; aTiempo: number }> {
    const condicionesFecha: string[] = [];
    const parametros: unknown[] = [margenMinutos];
    let indice = 2;

    if (desde) {
      condicionesFecha.push(`a.fecha_asignacion >= $${indice}`);
      parametros.push(desde);
      indice++;
    }
    if (hasta) {
      condicionesFecha.push(`a.fecha_asignacion <= $${indice}`);
      parametros.push(hasta);
      indice++;
    }

    const filtroFecha =
      condicionesFecha.length > 0
        ? `AND ${condicionesFecha.join(' AND ')}`
        : '';

    const [fila] = await this.ejecucionRutaRepository.query(
      `
      SELECT
        COUNT(*)::int AS evaluables,
        COUNT(*) FILTER (
          WHERE EXTRACT(EPOCH FROM (e.tiempo_fin - e.tiempo_inicio)) / 60.0
            <= COALESCE(
              r.estimacion_duracion_minutos,
              EXTRACT(EPOCH FROM (a.planificacion_tiempo_fin - a.planificacion_tiempo_inicio)) / 60.0
            ) + $1
        )::int AS a_tiempo
      FROM ejecucion_rutas e
      INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
      INNER JOIN rutas r ON r.id = a.ruta_id
      WHERE e.estado IN ('COMPLETADO', 'PARCIAL')
        AND e.tiempo_inicio IS NOT NULL
        AND e.tiempo_fin IS NOT NULL
        AND COALESCE(
          r.estimacion_duracion_minutos,
          EXTRACT(EPOCH FROM (a.planificacion_tiempo_fin - a.planificacion_tiempo_inicio)) / 60.0
        ) IS NOT NULL
        ${filtroFecha}
      `,
      parametros,
    );

    return {
      evaluables: Number(fila?.evaluables ?? 0),
      aTiempo: Number(fila?.a_tiempo ?? 0),
    };
  }

  private async obtenerIncidenciasPorEjecucion(
    desde?: string,
    hasta?: string,
  ): Promise<{ total: number; conIncidencias: number }> {
    const condicionesFecha: string[] = [];
    const parametros: unknown[] = [];
    let indice = 1;

    if (desde) {
      condicionesFecha.push(`a.fecha_asignacion >= $${indice}`);
      parametros.push(desde);
      indice++;
    }
    if (hasta) {
      condicionesFecha.push(`a.fecha_asignacion <= $${indice}`);
      parametros.push(hasta);
      indice++;
    }

    const filtroFecha =
      condicionesFecha.length > 0
        ? `WHERE ${condicionesFecha.join(' AND ')}`
        : '';

    const [fila] = await this.ejecucionRutaRepository.query(
      `
      SELECT
        COUNT(DISTINCT e.id)::int AS total,
        COUNT(DISTINCT i.ejecucion_ruta_id)::int AS con_incidencias
      FROM ejecucion_rutas e
      INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
      LEFT JOIN incidencias i ON i.ejecucion_ruta_id = e.id
      ${filtroFecha}
      `,
      parametros,
    );

    return {
      total: Number(fila?.total ?? 0),
      conIncidencias: Number(fila?.con_incidencias ?? 0),
    };
  }

  private async obtenerMetricasKilometros(
    desde?: string,
    hasta?: string,
  ): Promise<{ promedio: number | null; totalConOdometro: number }> {
    const condicionesFecha: string[] = [];
    const parametros: unknown[] = [];
    let indice = 1;

    if (desde) {
      condicionesFecha.push(`a.fecha_asignacion >= $${indice}`);
      parametros.push(desde);
      indice++;
    }
    if (hasta) {
      condicionesFecha.push(`a.fecha_asignacion <= $${indice}`);
      parametros.push(hasta);
      indice++;
    }

    const filtroFecha =
      condicionesFecha.length > 0
        ? `AND ${condicionesFecha.join(' AND ')}`
        : '';

    const [fila] = await this.ejecucionRutaRepository.query(
      `
      SELECT
        COUNT(*)::int AS total_con_odometro,
        ROUND(AVG(e.odometro_fin - e.odometro_inicio)::numeric, 2) AS promedio_km
      FROM ejecucion_rutas e
      INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
      WHERE e.odometro_inicio IS NOT NULL
        AND e.odometro_fin IS NOT NULL
        AND e.odometro_fin >= e.odometro_inicio
        ${filtroFecha}
      `,
      parametros,
    );

    const totalConOdometro = Number(fila?.total_con_odometro ?? 0);
    const promedio =
      fila?.promedio_km != null ? Number(fila.promedio_km) : null;

    return { promedio, totalConOdometro };
  }

  private async obtenerDetalleRutasCamioneros(
    desde?: string,
    hasta?: string,
    margenMinutos: number = MARGEN_MINUTOS_A_TIEMPO_DEFAULT,
  ): Promise<
    Array<{
      conductorId: string;
      nombreCompleto: string;
      rutasAsignadas: number;
      rutasEjecutadas: number;
      rutasCompletadas: number;
      rutasParciales: number;
      rutasCanceladas: number;
      tiempoPromedioMinutosPorRuta: number | null;
      promedioKilometrosPorRuta: number | null;
      rutasEvaluablesTiempo: number;
      rutasCompletadasATiempo: number;
    }>
  > {
    const { sql, parametros } = this.construirFiltroFechaAsignacionSql(
      desde,
      hasta,
      2,
    );

    const filas = await this.ejecucionRutaRepository.query(
      `
      SELECT
        u.id AS conductor_id,
        TRIM(
          CONCAT(
            u.nombre,
            ' ',
            u.apellido_paterno,
            ' ',
            COALESCE(u.apellido_materno, '')
          )
        ) AS nombre_completo,
        COUNT(DISTINCT a.id)::int AS rutas_asignadas,
        COUNT(DISTINCT e.id) FILTER (
          WHERE e.id IS NOT NULL AND e.estado != 'NO_INICIADO'
        )::int AS rutas_ejecutadas,
        COUNT(DISTINCT e.id) FILTER (WHERE e.estado = 'COMPLETADO')::int AS rutas_completadas,
        COUNT(DISTINCT e.id) FILTER (WHERE e.estado = 'PARCIAL')::int AS rutas_parciales,
        COUNT(DISTINCT e.id) FILTER (WHERE e.estado = 'CANCELADO')::int AS rutas_canceladas,
        ROUND(
          AVG(EXTRACT(EPOCH FROM (e.tiempo_fin - e.tiempo_inicio)) / 60.0)
          FILTER (
            WHERE e.tiempo_inicio IS NOT NULL AND e.tiempo_fin IS NOT NULL
          )::numeric,
          2
        ) AS tiempo_promedio_minutos,
        ROUND(
          AVG(e.odometro_fin - e.odometro_inicio)
          FILTER (
            WHERE e.odometro_inicio IS NOT NULL
              AND e.odometro_fin IS NOT NULL
              AND e.odometro_fin >= e.odometro_inicio
          )::numeric,
          2
        ) AS promedio_kilometros,
        COUNT(*) FILTER (
          WHERE e.estado IN ('COMPLETADO', 'PARCIAL')
            AND e.tiempo_inicio IS NOT NULL
            AND e.tiempo_fin IS NOT NULL
            AND COALESCE(
              r.estimacion_duracion_minutos,
              EXTRACT(EPOCH FROM (a.planificacion_tiempo_fin - a.planificacion_tiempo_inicio)) / 60.0
            ) IS NOT NULL
        )::int AS rutas_evaluables_tiempo,
        COUNT(*) FILTER (
          WHERE e.estado IN ('COMPLETADO', 'PARCIAL')
            AND e.tiempo_inicio IS NOT NULL
            AND e.tiempo_fin IS NOT NULL
            AND COALESCE(
              r.estimacion_duracion_minutos,
              EXTRACT(EPOCH FROM (a.planificacion_tiempo_fin - a.planificacion_tiempo_inicio)) / 60.0
            ) IS NOT NULL
            AND EXTRACT(EPOCH FROM (e.tiempo_fin - e.tiempo_inicio)) / 60.0 <= COALESCE(
              r.estimacion_duracion_minutos,
              EXTRACT(EPOCH FROM (a.planificacion_tiempo_fin - a.planificacion_tiempo_inicio)) / 60.0
            ) + $1
        )::int AS rutas_a_tiempo
      FROM asignacion_rutas a
      INNER JOIN usuarios u ON u.id = a.conductor_id AND u.deleted_at IS NULL
      INNER JOIN rutas r ON r.id = a.ruta_id
      LEFT JOIN ejecucion_rutas e ON e.asignacion_ruta_id = a.id
      WHERE 1 = 1
        ${sql}
      GROUP BY u.id, u.nombre, u.apellido_paterno, u.apellido_materno
      ORDER BY rutas_asignadas DESC
      `,
      [margenMinutos, ...parametros],
    );

    return filas.map(
      (fila: {
        conductor_id: string;
        nombre_completo: string;
        rutas_asignadas: number;
        rutas_ejecutadas: number;
        rutas_completadas: number;
        rutas_parciales: number;
        rutas_canceladas: number;
        tiempo_promedio_minutos: string | null;
        promedio_kilometros: string | null;
        rutas_evaluables_tiempo: number;
        rutas_a_tiempo: number;
      }) => ({
        conductorId: fila.conductor_id,
        nombreCompleto: fila.nombre_completo,
        rutasAsignadas: Number(fila.rutas_asignadas),
        rutasEjecutadas: Number(fila.rutas_ejecutadas),
        rutasCompletadas: Number(fila.rutas_completadas),
        rutasParciales: Number(fila.rutas_parciales),
        rutasCanceladas: Number(fila.rutas_canceladas),
        tiempoPromedioMinutosPorRuta:
          fila.tiempo_promedio_minutos != null
            ? Number(fila.tiempo_promedio_minutos)
            : null,
        promedioKilometrosPorRuta:
          fila.promedio_kilometros != null
            ? Number(fila.promedio_kilometros)
            : null,
        rutasEvaluablesTiempo: Number(fila.rutas_evaluables_tiempo),
        rutasCompletadasATiempo: Number(fila.rutas_a_tiempo),
      }),
    );
  }

  private async obtenerPuntosPorConductor(
    desde?: string,
    hasta?: string,
  ): Promise<
    Array<{
      conductorId: string;
      puntosTotales: number;
      puntosAtendidos: number;
    }>
  > {
    const { sql, parametros } = this.construirFiltroFechaAsignacionSql(
      desde,
      hasta,
    );

    const filas = await this.ejecucionRutaRepository.query(
      `
      SELECT
        a.conductor_id,
        COUNT(pre.id)::int AS puntos_totales,
        COUNT(*) FILTER (WHERE pre.estado = 'COMPLETADO')::int AS puntos_atendidos
      FROM asignacion_rutas a
      INNER JOIN ejecucion_rutas e ON e.asignacion_ruta_id = a.id
      INNER JOIN punto_ruta_ejecucion pre ON pre.ejecucion_ruta_id = e.id
      WHERE 1 = 1
        ${sql}
      GROUP BY a.conductor_id
      `,
      parametros,
    );

    return filas.map(
      (fila: {
        conductor_id: string;
        puntos_totales: number;
        puntos_atendidos: number;
      }) => ({
        conductorId: fila.conductor_id,
        puntosTotales: Number(fila.puntos_totales),
        puntosAtendidos: Number(fila.puntos_atendidos),
      }),
    );
  }

  private async obtenerIncidenciasEnRutasPorConductor(
    desde?: string,
    hasta?: string,
  ): Promise<Array<{ conductorId: string; total: number }>> {
    const { sql, parametros } = this.construirFiltroFechaAsignacionSql(
      desde,
      hasta,
    );

    const filas = await this.ejecucionRutaRepository.query(
      `
      SELECT
        conductor_id,
        COUNT(*)::int AS total
      FROM (
        SELECT DISTINCT a.conductor_id, i.id AS incidencia_id
        FROM incidencias i
        INNER JOIN ejecucion_rutas e ON i.ejecucion_ruta_id = e.id
        INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
        WHERE 1 = 1
          ${sql}
        UNION
        SELECT DISTINCT a.conductor_id, i.id AS incidencia_id
        FROM incidencias i
        INNER JOIN punto_ruta_ejecucion pre ON i.punto_ejecucion_ruta_id = pre.id
        INNER JOIN ejecucion_rutas e ON e.id = pre.ejecucion_ruta_id
        INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
        WHERE 1 = 1
          ${sql}
      ) incidencias_conductor
      GROUP BY conductor_id
      `,
      parametros,
    );

    return filas.map((fila: { conductor_id: string; total: number }) => ({
      conductorId: fila.conductor_id,
      total: Number(fila.total),
    }));
  }

  private async obtenerIncidenciasReportadasPorConductor(
    desde?: string,
    hasta?: string,
  ): Promise<Array<{ conductorId: string; total: number }>> {
    const { sql, parametros } = this.construirFiltroFechaAsignacionSql(
      desde,
      hasta,
    );

    const filas = await this.ejecucionRutaRepository.query(
      `
      SELECT
        conductor_id,
        COUNT(*)::int AS total
      FROM (
        SELECT DISTINCT a.conductor_id, i.id AS incidencia_id
        FROM incidencias i
        INNER JOIN ejecucion_rutas e ON i.ejecucion_ruta_id = e.id
        INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
        WHERE i.reportado_por_usuario_id = a.conductor_id
          ${sql}
        UNION
        SELECT DISTINCT a.conductor_id, i.id AS incidencia_id
        FROM incidencias i
        INNER JOIN punto_ruta_ejecucion pre ON i.punto_ejecucion_ruta_id = pre.id
        INNER JOIN ejecucion_rutas e ON e.id = pre.ejecucion_ruta_id
        INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
        WHERE i.reportado_por_usuario_id = a.conductor_id
          ${sql}
      ) incidencias_reportadas
      GROUP BY conductor_id
      `,
      parametros,
    );

    return filas.map((fila: { conductor_id: string; total: number }) => ({
      conductorId: fila.conductor_id,
      total: Number(fila.total),
    }));
  }

  private async obtenerBacklogCamioneros(): Promise<{
    conductoresConRutaEnProgreso: number;
    conductoresConRutaParcial: number;
  }> {
    const [fila] = await this.ejecucionRutaRepository.query(`
      SELECT
        COUNT(DISTINCT a.conductor_id) FILTER (
          WHERE e.estado = 'EN_PROGRESO'
        )::int AS en_progreso,
        COUNT(DISTINCT a.conductor_id) FILTER (
          WHERE e.estado = 'PARCIAL'
        )::int AS parcial
      FROM ejecucion_rutas e
      INNER JOIN asignacion_rutas a ON a.id = e.asignacion_ruta_id
    `);

    return {
      conductoresConRutaEnProgreso: Number(fila?.en_progreso ?? 0),
      conductoresConRutaParcial: Number(fila?.parcial ?? 0),
    };
  }

  private calcularPorcentaje(
    parcial: number,
    total: number,
  ): number | null {
    if (total === 0) {
      return null;
    }
    return Math.round((parcial / total) * 10000) / 100;
  }
}
