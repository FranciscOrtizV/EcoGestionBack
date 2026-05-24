import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { EjecucionRuta, Incidencia } from 'src/common/entities';
import {
  EstadoEjecucionRutaEnum,
  EstadoIncidenciaEnum,
  PrioridadIncidenciaEnum,
} from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { FiltroMetricasIncidenciasDto } from './dto/filtro-metricas-incidencias.dto';
import { FiltroMetricasRutasDto } from './dto/filtro-metricas-rutas.dto';

const MARGEN_MINUTOS_A_TIEMPO_DEFAULT = 15;

@Injectable()
export class EstadisticasService {
  constructor(
    @InjectRepository(EjecucionRuta)
    private readonly ejecucionRutaRepository: Repository<EjecucionRuta>,

    @InjectRepository(Incidencia)
    private readonly incidenciaRepository: Repository<Incidencia>,
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
      'Métricas de rutas y ejecución obtenidas correctamente',
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
      'Métricas de incidencias obtenidas correctamente',
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
